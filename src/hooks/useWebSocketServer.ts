import { useCallback, useRef, useState } from 'react';
import { ChatMessage, ConnectionStatus, PermissionDenial, PermissionMode, Session, StoredItem } from '../types';

let msgIdCounter = 1;
function nextId() { return msgIdCounter++; }

const CALL_TIMEOUT_MS = 30_000;
const INIT_TIMEOUT_MS = 10_000;

export function useWebSocketServer() {
  const [url, setUrl] = useState('ws://localhost:3284');
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [lastError, setLastError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const pendingRef = useRef<Map<number, {
    method: string;
    resolve: (v: unknown) => void;
    reject: (e: unknown) => void;
    startedAt: number;
  }>>(new Map());
  const sessionRef = useRef<Session[]>([]);
  sessionRef.current = sessions;

  const rejectAllPending = useCallback((reason: string) => {
    const pending = pendingRef.current;
    if (pending.size === 0) return;
    pending.forEach(({ reject }) => {
      reject(new Error(reason));
    });
    pending.clear();
  }, []);

  const rawSend = useCallback((msg: object): boolean => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(msg));
    return true;
  }, []);

  const call = useCallback(<T = unknown>(method: string, params?: object): Promise<T> => {
    return new Promise((resolve, reject) => {
      const id = nextId();
      const startedAt = Date.now();

      const sent = rawSend({ jsonrpc: '2.0', id, method, params: params ?? {} });
      if (!sent) {
        reject(new Error(`call(${method}): socket not open, cannot send`));
        return;
      }

      pendingRef.current.set(id, { method, resolve: resolve as (v: unknown) => void, reject, startedAt });

      const timer = setTimeout(() => {
        if (!pendingRef.current.has(id)) return;
        pendingRef.current.delete(id);
        reject(new Error(`Request timed out: ${method} (${Date.now() - startedAt}ms)`));
      }, CALL_TIMEOUT_MS);

      const origResolve = resolve as (v: unknown) => void;
      const entry = pendingRef.current.get(id)!;
      entry.resolve = (v) => { clearTimeout(timer); origResolve(v as T); };
      entry.reject = (e) => { clearTimeout(timer); reject(e); };
    });
  }, [rawSend]);

  const updateSession = useCallback((thread_id: string, updater: (s: Session) => Session) => {
    setSessions(prev => prev.map(s => s.thread_id === thread_id ? updater(s) : s));
  }, []);

  const handleNotification = useCallback((method: string, params: unknown) => {
    const p = params as Record<string, unknown>;

    if (method === 'initialized') return;

    if (method === 'turn/started') {
      const { turn_id, thread_id } = p as { turn_id: string; thread_id: string };
      updateSession(thread_id, s => ({ ...s, active_turn_id: turn_id }));
      return;
    }

    if (method === 'item/progress') {
      const { turn_id, delta } = p as { turn_id: string; delta: { type: string; text?: string } };
      const session = sessionRef.current.find(s => s.active_turn_id === turn_id);
      if (!session) return;
      if (delta.type === 'text' && delta.text) {
        setSessions(prev => prev.map(s => {
          if (s.thread_id !== session.thread_id) return s;
          const msgs = [...s.messages];
          const lastMsg = msgs[msgs.length - 1];
          if (lastMsg && lastMsg.role === 'assistant' && lastMsg.isStreaming) {
            msgs[msgs.length - 1] = { ...lastMsg, streamingText: (lastMsg.streamingText ?? '') + delta.text };
          } else {
            msgs.push({ id: `streaming-${turn_id}`, role: 'assistant', content: '', streamingText: delta.text, isStreaming: true, items: [] });
          }
          return { ...s, messages: msgs };
        }));
      }
      return;
    }

    if (method === 'item/created') {
      const { turn_id, item } = p as { turn_id: string; item: StoredItem };
      const session = sessionRef.current.find(s => s.active_turn_id === turn_id);
      if (!session) return;
      setSessions(prev => prev.map(s => {
        if (s.thread_id !== session.thread_id) return s;
        const msgs = [...s.messages];
        const filteredMsgs = msgs.filter(m => !(m.isStreaming && item.item.type === 'text'));
        let assistantMsg = filteredMsgs.find(m => m.role === 'assistant' && m.id === `turn-${turn_id}`);
        if (!assistantMsg) {
          filteredMsgs.push({ id: `turn-${turn_id}`, role: 'assistant', content: '', items: [item], isStreaming: false });
        } else {
          const idx = filteredMsgs.findIndex(m => m.id === `turn-${turn_id}`);
          filteredMsgs[idx] = { ...assistantMsg, items: [...(assistantMsg.items ?? []), item] };
        }
        return { ...s, messages: filteredMsgs };
      }));
      return;
    }

    if (method === 'turn/permission_denied') {
      const { thread_id, denials } = p as { thread_id: string; denials: PermissionDenial[] };
      updateSession(thread_id, s => ({
        ...s,
        hasPermissionDenial: true,
        permissionDenials: denials,
        lastBlockedContent: s.lastBlockedContent ?? s.messages.filter(m => m.role === 'user').pop()?.content,
      }));
      return;
    }

    if (method === 'turn/completed' || method === 'turn/error') {
      const { thread_id } = p as { turn_id: string; thread_id: string; status?: string; error?: string };
      updateSession(thread_id, s => {
        const msgs = s.messages.map(m => m.isStreaming ? { ...m, isStreaming: false, items: m.items ?? [] } : m);
        return { ...s, active_turn_id: undefined, messages: msgs };
      });
      return;
    }
  }, [updateSession]);

  const connect = useCallback((serverUrl: string) => {
    const existing = wsRef.current;
    if (existing && existing.url === serverUrl &&
        (existing.readyState === WebSocket.CONNECTING || existing.readyState === WebSocket.OPEN)) {
      return;
    }
    if (existing) {
      existing.close();
    }
    setStatus('connecting');
    setLastError(null);
    setUrl(serverUrl);
    const ws = new WebSocket(serverUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (wsRef.current !== ws) return;
      const id = nextId();
      const startedAt = Date.now();
      const initTimer = setTimeout(() => {
        if (pendingRef.current.has(id)) {
          pendingRef.current.delete(id);
          setLastError('Initialize timed out — server connected but did not respond');
          setStatus('error');
        }
      }, INIT_TIMEOUT_MS);

      pendingRef.current.set(id, {
        method: 'initialize',
        startedAt,
        resolve: () => {
          clearTimeout(initTimer);
          console.log('[WS] Connected');
          setStatus('connected');
        },
        reject: (e) => {
          clearTimeout(initTimer);
          setLastError(`Initialize rejected: ${e instanceof Error ? e.message : JSON.stringify(e)}`);
          setStatus('error');
        },
      });
      ws.send(JSON.stringify({ jsonrpc: '2.0', id, method: 'initialize', params: { client: { name: 'clode-app', version: '1.0.0' } } }));
    };

    ws.onmessage = (event) => {
      if (wsRef.current !== ws) return;
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(event.data as string);
      } catch {
        return;
      }

      if ('id' in msg && ('result' in msg || 'error' in msg)) {
        const id = msg.id as number;
        const pending = pendingRef.current.get(id);
        if (pending) {
          pendingRef.current.delete(id);
          if ('error' in msg) {
            pending.reject(msg.error);
          } else {
            pending.resolve(msg.result);
          }
        }
        return;
      }

      if ('method' in msg) {
        handleNotification(msg.method as string, msg.params);
        return;
      }
    };

    ws.onclose = (event) => {
      if (wsRef.current === ws) {
        wsRef.current = null;
        rejectAllPending(`WebSocket closed (code=${event.code})`);
      }
      const reason = event.reason || '';
      if (event.code === 1000) {
        setStatus('disconnected');
      } else if (event.code === 1006) {
        setLastError(reason || 'Connection failed — check URL and that the server is running');
        setStatus('error');
      } else {
        setLastError(reason || `Closed with code ${event.code}`);
        setStatus('error');
      }
    };

    ws.onerror = () => {};
  }, [handleNotification, rejectAllPending]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    setSessions([]);
  }, []);

  const createSession = useCallback(async (cwd: string, permission_mode: PermissionMode) => {
    const result = await call<{ thread_id: string; created_at: number }>('thread/start', { cwd, permission_mode });
    const session: Session = { thread_id: result.thread_id, created_at: result.created_at, cwd, permission_mode, turns: [], messages: [] };
    setSessions(prev => [...prev, session]);
    return session;
  }, [call]);

  const sendMessage = useCallback(async (thread_id: string, content: string, model?: string) => {
    setSessions(prev => prev.map(s => {
      if (s.thread_id !== thread_id) return s;
      return {
        ...s,
        messages: [...s.messages, { id: `user-${Date.now()}`, role: 'user' as const, content }],
        lastBlockedContent: content,
        hasPermissionDenial: false,
        permissionDenials: undefined,
      };
    }));
    const result = await call<{ turn_id: string }>('turn/start', { thread_id, content, model });
    return result;
  }, [call]);

  const interruptTurn = useCallback(async (thread_id: string) => {
    await call('turn/interrupt', { thread_id });
  }, [call]);

  const approvePermission = useCallback(async (thread_id: string, permission_mode?: PermissionMode) => {
    try {
      await call('approval/respond', { thread_id, approved: true, permission_mode });
    } catch {}
    updateSession(thread_id, s => ({
      ...s,
      permission_mode: permission_mode ?? 'acceptEdits',
      hasPermissionDenial: false,
      permissionDenials: undefined,
    }));
  }, [call, updateSession]);

  const changePermissionMode = useCallback(async (thread_id: string, permission_mode: PermissionMode) => {
    try {
      await call('approval/respond', { thread_id, approved: true, permission_mode });
    } catch {}
    updateSession(thread_id, s => ({ ...s, permission_mode }));
  }, [call, updateSession]);

  const setLastBlocked = useCallback((thread_id: string, content: string) => {
    updateSession(thread_id, s => ({ ...s, lastBlockedContent: content }));
  }, [updateSession]);

  const dismissPermissionDenial = useCallback((thread_id: string) => {
    updateSession(thread_id, s => ({
      ...s,
      hasPermissionDenial: false,
      permissionDenials: undefined,
    }));
  }, [updateSession]);

  const deleteSession = useCallback(async (thread_id: string) => {
    const session = sessionRef.current.find(s => s.thread_id === thread_id);
    if (session?.active_turn_id) {
      try { await call('turn/interrupt', { thread_id }); } catch { /* ignore */ }
    }
    setSessions(prev => prev.filter(s => s.thread_id !== thread_id));
  }, [call]);

  return {
    url, status, lastError, sessions,
    connect, disconnect,
    createSession, sendMessage, interruptTurn,
    approvePermission, changePermissionMode, setLastBlocked, dismissPermissionDenial, deleteSession,
  };
}

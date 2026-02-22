import React, { useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ChatScreen } from './src/screens/ChatScreen';
import { ConnectScreen } from './src/screens/ConnectScreen';
import { SessionsScreen } from './src/screens/SessionsScreen';
import { useWebSocketServer } from './src/hooks/useWebSocketServer';
import { PermissionMode, Session } from './src/types';
import { theme } from './src/theme';

type Screen = 'connect' | 'sessions' | 'chat';

export default function App() {
  const [screen, setScreen] = useState<Screen>('connect');
  const [activeSession, setActiveSession] = useState<Session | null>(null);

  const {
    url, status, lastError, sessions,
    connect, disconnect,
    createSession, sendMessage, interruptTurn,
    approvePermission, changePermissionMode, setLastBlocked, dismissPermissionDenial, deleteSession,
  } = useWebSocketServer();

  React.useEffect(() => {
    if (status === 'connected' && screen === 'connect') {
      setScreen('sessions');
    } else if ((status === 'disconnected' || status === 'error') && screen !== 'connect') {
      setScreen('connect');
      setActiveSession(null);
    }
  }, [status]);

  const currentSession = activeSession
    ? sessions.find(s => s.thread_id === activeSession.thread_id) ?? null
    : null;

  const handleOpenSession = (session: Session) => {
    setActiveSession(session);
    setScreen('chat');
  };

  const handleCreateSession = async (cwd: string, mode: PermissionMode) => {
    const session = await createSession(cwd, mode);
    setActiveSession(session);
    setScreen('chat');
  };

  const handleSendMessage = async (thread_id: string, content: string, model?: string) => {
    setLastBlocked(thread_id, content);
    await sendMessage(thread_id, content, model);
  };

  const handleApprove = async (thread_id: string, mode: PermissionMode) => {
    await approvePermission(thread_id, mode);
  };

  const handleDismissBanner = (thread_id: string) => {
    dismissPermissionDenial(thread_id);
  };

  return (
    <SafeAreaProvider>
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={theme.bg} />
      {screen === 'connect' && (
        <SafeAreaView style={styles.safeArea}>
          <ConnectScreen
            status={status}
            lastError={lastError}
            url={url}
            onConnect={connect}
            onDisconnect={() => { disconnect(); setScreen('connect'); }}
          />
        </SafeAreaView>
      )}
      {screen === 'sessions' && (
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Sessions</Text>
            <Text style={styles.headerStatus}>● Connected</Text>
          </View>
          <SessionsScreen
            sessions={sessions}
            onCreateSession={handleCreateSession}
            onOpenSession={handleOpenSession}
            onDeleteSession={deleteSession}
          />
        </SafeAreaView>
      )}
      {screen === 'chat' && currentSession && (
        <ChatScreen
          session={currentSession}
          onSendMessage={handleSendMessage}
          onInterrupt={interruptTurn}
          onApprovePermission={handleApprove}
          onChangePermission={changePermissionMode}
          onDismissBanner={handleDismissBanner}
          onBack={() => setScreen('sessions')}
        />
      )}
    </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  headerTitle: { color: theme.fg, fontSize: 18, fontWeight: '700' },
  headerStatus: { color: theme.green, fontSize: 13, fontWeight: '600' },
});

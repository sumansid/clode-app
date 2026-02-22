import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChatMessage, StoredItem } from '../types';
import { theme, palette } from '../theme';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

function NvimSpinner({ color = theme.yellow, label }: { color?: string; label?: string }) {
  const [frame, setFrame] = useState(0);
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const id = setInterval(() => setFrame(f => (f + 1) % SPINNER_FRAMES.length), 80);
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 400, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => { clearInterval(id); pulse.stop(); };
  }, []);

  return (
    <Animated.View style={[styles.spinnerRow, { opacity }]}>
      <Text style={[styles.spinnerChar, { color }]}>{SPINNER_FRAMES[frame]}</Text>
      {label && <Text style={[styles.spinnerLabel, { color }]}>{label}</Text>}
    </Animated.View>
  );
}

const TOOL_META: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  Bash:       { color: theme.synString,   bg: `rgba(138,154,123,0.10)`, icon: '$',  label: 'Running command' },
  Write:      { color: theme.synFunction, bg: `rgba(133,159,172,0.10)`, icon: '+',  label: 'Writing file' },
  Edit:       { color: theme.synFunction, bg: `rgba(133,159,172,0.10)`, icon: '~',  label: 'Editing file' },
  MultiEdit:  { color: theme.synFunction, bg: `rgba(133,159,172,0.10)`, icon: '~',  label: 'Editing files' },
  Read:       { color: theme.fgDimmer,    bg: `rgba(114,113,105,0.08)`, icon: '>',  label: 'Reading' },
  Glob:       { color: theme.fgDimmer,    bg: `rgba(114,113,105,0.08)`, icon: '*',  label: 'Searching' },
  Grep:       { color: theme.fgDimmer,    bg: `rgba(114,113,105,0.08)`, icon: '/',  label: 'Searching' },
  Task:       { color: theme.orange,      bg: `rgba(182,146,123,0.10)`, icon: '>',  label: 'Running task' },
  WebFetch:   { color: theme.accent,      bg: `rgba(101,133,148,0.10)`, icon: '↗',  label: 'Fetching' },
  WebSearch:  { color: theme.accent,      bg: `rgba(101,133,148,0.10)`, icon: '?',  label: 'Searching web' },
};

const QUIET_TOOLS = new Set(['Read', 'Glob', 'Grep']);

function toolMeta(name: string) {
  return TOOL_META[name] ?? { color: theme.fgDimmer, bg: `rgba(114,113,105,0.06)`, icon: '>', label: name };
}

type Segment = { type: 'text'; content: string } | { type: 'code'; content: string; lang?: string };

function parseSegments(text: string): Segment[] {
  const out: Segment[] = [];
  const re = /```(\w*)\n?([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ type: 'text', content: text.slice(last, m.index) });
    out.push({ type: 'code', content: m[2].trim(), lang: m[1] || undefined });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: 'text', content: text.slice(last) });
  return out.length ? out : [{ type: 'text', content: text }];
}

function InlineText({ text, baseStyle }: { text: string; baseStyle?: object }) {
  const parts = text.split(/(`[^`\n]+`)/g);
  if (parts.length === 1) return <Text style={[styles.assistantText, baseStyle]}>{text}</Text>;
  return (
    <Text style={[styles.assistantText, baseStyle]}>
      {parts.map((p, i) =>
        p.startsWith('`') && p.endsWith('`') && p.length > 2
          ? <Text key={i} style={styles.inlineCode}>{p.slice(1, -1)}</Text>
          : p
      )}
    </Text>
  );
}

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  return (
    <View style={styles.codeBlock}>
      {lang ? (
        <View style={styles.codeLangRow}>
          <Text style={styles.codeLang}>{lang}</Text>
        </View>
      ) : null}
      <Text style={styles.codeText} selectable>{code}</Text>
    </View>
  );
}

function TextRenderer({ text }: { text: string }) {
  const segs = parseSegments(text);
  if (segs.length === 1 && segs[0].type === 'text') {
    return <InlineText text={segs[0].content} />;
  }
  return (
    <View style={{ gap: 6 }}>
      {segs.map((s, i) =>
        s.type === 'code'
          ? <CodeBlock key={i} code={s.content} lang={s.lang} />
          : <InlineText key={i} text={s.content} />
      )}
    </View>
  );
}

function ThinkingBubble({ thinking }: { thinking: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <TouchableOpacity style={styles.thinking} onPress={() => setExpanded(e => !e)} activeOpacity={0.7}>
      <View style={styles.thinkingHeader}>
        <Text style={styles.thinkingLabel}>thinking...</Text>
        <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </View>
      {expanded && <Text style={styles.thinkingText}>{thinking}</Text>}
    </TouchableOpacity>
  );
}

function CompactToolCall({ item }: { item: { name: string; input: unknown } }) {
  const [expanded, setExpanded] = useState(false);
  const meta = toolMeta(item.name);
  const inp = item.input as Record<string, unknown>;

  const filePath = inp.file_path ?? inp.path ?? inp.notebook_path;
  const pattern = inp.pattern ?? null;
  const preview = filePath ?? pattern ?? '';

  return (
    <TouchableOpacity
      style={styles.compactTool}
      onPress={() => setExpanded(e => !e)}
      activeOpacity={0.7}
    >
      <Text style={styles.compactIcon}>{meta.icon}</Text>
      <Text style={styles.compactName}>{item.name}</Text>
      {preview ? (
        <Text style={styles.compactPath} numberOfLines={1}>{String(preview)}</Text>
      ) : null}
      {expanded && (
        <Text style={styles.compactRaw} selectable>
          {JSON.stringify(item.input, null, 2)}
        </Text>
      )}
    </TouchableOpacity>
  );
}

function ToolCallBubble({ item }: { item: { name: string; input: unknown } }) {
  if (QUIET_TOOLS.has(item.name)) return <CompactToolCall item={item} />;

  const [expanded, setExpanded] = useState(false);
  const meta = toolMeta(item.name);
  const inp = item.input as Record<string, unknown>;

  const filePath = inp.file_path ?? inp.path ?? inp.notebook_path;
  const command = item.name === 'Bash' ? inp.command : null;
  const pattern = inp.pattern ?? null;
  const url = inp.url ?? null;
  const previewValue = command ?? filePath ?? pattern ?? url;
  const isCmd = !!command;

  return (
    <TouchableOpacity
      style={[styles.toolCall, { backgroundColor: meta.bg, borderLeftColor: meta.color }]}
      onPress={() => setExpanded(e => !e)}
      activeOpacity={0.75}
    >
      <View style={styles.toolHeader}>
        <Text style={[styles.toolIcon, { color: meta.color }]}>{meta.icon}</Text>
        <Text style={styles.toolName}>{item.name}</Text>
        <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </View>

      {previewValue && (
        isCmd ? (
          <View style={styles.terminal}>
            <Text style={styles.terminalPrompt}>$</Text>
            <Text style={styles.terminalCmd} numberOfLines={expanded ? undefined : 3}>
              {String(previewValue)}
            </Text>
          </View>
        ) : (
          <Text style={styles.toolFilePath} numberOfLines={1}>
            {String(previewValue)}
          </Text>
        )
      )}

      {expanded && (
        <Text style={styles.toolRawInput} selectable>
          {JSON.stringify(item.input, null, 2)}
        </Text>
      )}
    </TouchableOpacity>
  );
}

function ToolResultBubble({ item }: { item: { content: string; is_error?: boolean } }) {
  const [expanded, setExpanded] = useState(false);
  const isBlocked = item.is_error && (
    item.content.includes('was blocked') || item.content.includes('requested permissions')
  );

  if (isBlocked) {
    return (
      <TouchableOpacity
        style={[styles.toolResult, { borderLeftColor: theme.orange }]}
        onPress={() => setExpanded(e => !e)}
        activeOpacity={0.75}
      >
        <View style={styles.toolResultHeader}>
          <Text style={[styles.toolResultLabel, { color: theme.orange }]}>blocked</Text>
          <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
        </View>
        <Text style={styles.toolResultContent} numberOfLines={expanded ? undefined : 2} selectable={expanded}>
          {item.content}
        </Text>
      </TouchableOpacity>
    );
  }

  if (item.is_error) {
    return (
      <TouchableOpacity
        style={[styles.toolResult, { borderLeftColor: theme.red }]}
        onPress={() => setExpanded(e => !e)}
        activeOpacity={0.75}
      >
        <View style={styles.toolResultHeader}>
          <Text style={[styles.toolResultLabel, { color: theme.red }]}>error</Text>
          <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
        </View>
        <Text style={styles.toolResultContent} numberOfLines={expanded ? undefined : 2} selectable={expanded}>
          {item.content}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.compactResult}
      onPress={() => setExpanded(e => !e)}
      activeOpacity={0.7}
    >
      <Text style={styles.compactResultCheck}>✓</Text>
      <Text style={styles.compactResultText} numberOfLines={expanded ? undefined : 1} selectable={expanded}>
        {item.content}
      </Text>
    </TouchableOpacity>
  );
}

function ItemRenderer({ storedItem }: { storedItem: StoredItem }) {
  const item = storedItem.item;
  if (item.type === 'text') return <TextRenderer text={item.text} />;
  if (item.type === 'thinking') return <ThinkingBubble thinking={item.thinking} />;
  if (item.type === 'tool_call') return <ToolCallBubble item={item} />;
  if (item.type === 'tool_result') return <ToolResultBubble item={item} />;
  return null;
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <View style={styles.userRow}>
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{message.content}</Text>
        </View>
      </View>
    );
  }

  const hasContent = (message.streamingText && message.streamingText.length > 0)
    || (message.items && message.items.length > 0);

  return (
    <View style={styles.assistantRow}>
      <View style={styles.assistantBubble}>
        {message.isStreaming && message.streamingText
          ? <InlineText text={message.streamingText} />
          : (message.items ?? []).map(item => <ItemRenderer key={item.id} storedItem={item} />)
        }
        {message.isStreaming && !hasContent && (
          <NvimSpinner label="thinking" />
        )}
        {message.isStreaming && hasContent && (
          <NvimSpinner color={theme.fgDimmer} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  spinnerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  spinnerChar: { fontFamily: 'monospace', fontSize: 14, fontWeight: '700' },
  spinnerLabel: { fontFamily: 'monospace', fontSize: 12 },

  userRow: { alignItems: 'flex-end', marginVertical: 4, marginHorizontal: 16 },
  userBubble: {
    backgroundColor: theme.accent,
    borderRadius: 20, borderBottomRightRadius: 5,
    paddingHorizontal: 16, paddingVertical: 10,
    maxWidth: '80%',
  },
  userText: { color: '#fff', fontSize: 15, lineHeight: 22 },

  assistantRow: { alignItems: 'flex-start', marginVertical: 4, marginHorizontal: 16 },
  assistantBubble: {
    backgroundColor: theme.surface,
    borderRadius: 20, borderBottomLeftRadius: 5,
    paddingHorizontal: 16, paddingVertical: 14,
    maxWidth: '94%',
    borderWidth: 1, borderColor: theme.border,
    gap: 6,
  },
  assistantText: { color: palette.oldWhite, fontSize: 15, lineHeight: 23 },
  inlineCode: {
    color: theme.synOperator, fontFamily: 'monospace',
    backgroundColor: 'rgba(196,116,110,0.12)',
    borderRadius: 4,
  },

  codeBlock: {
    backgroundColor: theme.bgDark,
    borderRadius: 8,
    borderWidth: 1, borderColor: theme.border,
    overflow: 'hidden',
  },
  codeLangRow: {
    backgroundColor: theme.surface,
    borderBottomWidth: 1, borderBottomColor: theme.border,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  codeLang: { color: theme.fgDimmer, fontSize: 10, fontFamily: 'monospace' },
  codeText: {
    color: theme.fg, fontFamily: 'monospace',
    fontSize: 12, lineHeight: 18,
    padding: 10,
  },

  thinking: {
    backgroundColor: `rgba(114,113,105,0.06)`,
    borderRadius: 6, borderLeftWidth: 2, borderLeftColor: theme.fgDimmer,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  thinkingHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  thinkingLabel: { color: theme.fgDimmer, fontSize: 11, fontFamily: 'monospace', flex: 1 },
  thinkingText: { color: theme.fgDimmer, fontSize: 11, lineHeight: 16, marginTop: 4 },

  chevron: { color: theme.fgMuted, fontSize: 9 },

  compactTool: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4,
    paddingVertical: 2,
  },
  compactIcon: {
    color: theme.fgDimmer, fontFamily: 'monospace', fontSize: 11, fontWeight: '700',
  },
  compactName: {
    color: theme.fgDimmer, fontFamily: 'monospace', fontSize: 11,
  },
  compactPath: {
    color: theme.fgMuted, fontFamily: 'monospace', fontSize: 10, flex: 1,
  },
  compactRaw: {
    color: theme.fgDimmer, fontFamily: 'monospace', fontSize: 10, lineHeight: 14,
    marginTop: 4, width: '100%',
  },

  toolCall: {
    borderRadius: 8, borderLeftWidth: 3,
    paddingHorizontal: 10, paddingVertical: 8,
  },
  toolHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toolIcon: {
    fontFamily: 'monospace', fontSize: 12, fontWeight: '800',
  },
  toolName: { color: palette.dragonWhite, fontSize: 12, fontWeight: '700', flex: 1 },
  toolFilePath: {
    color: theme.fgDim, fontFamily: 'monospace', fontSize: 11, marginTop: 4,
  },
  terminal: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: theme.bgDark,
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, marginTop: 4,
  },
  terminalPrompt: {
    color: theme.synString, fontFamily: 'monospace', fontSize: 12, fontWeight: '700',
    lineHeight: 18,
  },
  terminalCmd: {
    color: palette.oldWhite, fontFamily: 'monospace', fontSize: 12, lineHeight: 18, flex: 1,
  },
  toolRawInput: {
    color: theme.fgDimmer, fontFamily: 'monospace', fontSize: 10, marginTop: 6, lineHeight: 14,
  },

  toolResult: {
    backgroundColor: `rgba(114,113,105,0.05)`,
    borderRadius: 6, borderLeftWidth: 2,
    paddingHorizontal: 8, paddingVertical: 6,
  },
  toolResultHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  toolResultLabel: { fontSize: 11, fontWeight: '700', fontFamily: 'monospace', flex: 1 },
  toolResultContent: {
    color: theme.fgDimmer, fontFamily: 'monospace', fontSize: 10, lineHeight: 15,
  },

  compactResult: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 4, paddingVertical: 1,
  },
  compactResultCheck: {
    color: theme.green, fontFamily: 'monospace', fontSize: 10, lineHeight: 14,
  },
  compactResultText: {
    color: theme.fgDimmer, fontFamily: 'monospace', fontSize: 10, lineHeight: 14, flex: 1,
  },
});

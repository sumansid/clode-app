import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated, FlatList, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageBubble } from '../components/MessageBubble';
import { PermissionBanner } from '../components/PermissionBanner';
import { PermissionMode, Session } from '../types';
import { theme } from '../theme';

// ─── Neovim-style braille spinner for input area ─────────────────────────────
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

function InputSpinner() {
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
    <Animated.View style={[styles.inputSpinner, { opacity }]}>
      <Text style={styles.inputSpinnerChar}>{SPINNER_FRAMES[frame]}</Text>
      <Text style={styles.inputSpinnerLabel}>working</Text>
    </Animated.View>
  );
}

const MODELS = ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5'];
const PERMISSION_MODES: PermissionMode[] = ['default', 'acceptEdits', 'bypassPermissions', 'dontAsk'];

interface Props {
  session: Session;
  onSendMessage: (thread_id: string, content: string, model?: string) => Promise<void>;
  onInterrupt: (thread_id: string) => Promise<void>;
  onApprovePermission: (thread_id: string, mode: PermissionMode) => Promise<void>;
  onChangePermission: (thread_id: string, mode: PermissionMode) => Promise<void>;
  onDismissBanner: (thread_id: string) => void;
  onBack: () => void;
}

export function ChatScreen({
  session, onSendMessage, onInterrupt, onApprovePermission, onChangePermission, onDismissBanner, onBack,
}: Props) {
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState('');
  const [model, setModel] = useState(MODELS[0]);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showPermPicker, setShowPermPicker] = useState(false);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const lastUserMessage = useRef<string>('');
  const autoScrollEnabled = useRef(true);

  const isActive = !!session.active_turn_id;

  const hasBlockedAction = !!session.hasPermissionDenial && !isActive;

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isActive || sending) return;
    setInput('');
    setSending(true);
    lastUserMessage.current = text;
    try {
      await onSendMessage(session.thread_id, text, model);
    } finally {
      setSending(false);
    }
  }, [input, isActive, sending, onSendMessage, session.thread_id, model]);

  const handleApprove = useCallback(async (mode: PermissionMode) => {
    const retryContent = session.lastBlockedContent ?? lastUserMessage.current;
    await onApprovePermission(session.thread_id, mode);
    if (retryContent) {
      await onSendMessage(session.thread_id, retryContent, model);
    }
  }, [onApprovePermission, onSendMessage, session.thread_id, session.lastBlockedContent, model]);

  // Auto-scroll: track last message count + streaming content to scroll on any update
  const lastStreamingText = session.messages.length > 0
    ? session.messages[session.messages.length - 1]?.streamingText
    : undefined;
  const lastItemCount = session.messages.length > 0
    ? session.messages[session.messages.length - 1]?.items?.length
    : undefined;

  useEffect(() => {
    if (autoScrollEnabled.current && session.messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [session.messages.length, lastStreamingText, lastItemCount]);

  const shortId = session.thread_id.slice(0, 8);
  const modelLabel = model.replace('claude-', '').replace('-4-6', ' 4.6').replace('-4-5', ' 4.5');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>#{shortId}</Text>
          <Text style={styles.headerCwd} numberOfLines={1}>{session.cwd}</Text>
        </View>
        <TouchableOpacity style={styles.permBtn} onPress={() => setShowPermPicker(true)}>
          <Text style={styles.permBtnText}>{session.permission_mode}</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={session.messages}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <MessageBubble message={item} />}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => {
          if (autoScrollEnabled.current) {
            flatListRef.current?.scrollToEnd({ animated: true });
          }
        }}
        onScroll={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
          const distFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
          autoScrollEnabled.current = distFromBottom < 100;
        }}
        scrollEventThrottle={100}
      />

      {/* Permission Banner */}
      {hasBlockedAction && (
        <PermissionBanner
          denials={session.permissionDenials}
          onApprove={handleApprove}
          onDismiss={() => onDismissBanner(session.thread_id)}
        />
      )}

      {/* Input Area */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {isActive && <InputSpinner />}
        <View style={[styles.inputArea, { paddingBottom: insets.bottom + 8 }]}>
          <TouchableOpacity style={styles.modelBtn} onPress={() => setShowModelPicker(true)}>
            <Text style={styles.modelBtnText}>{modelLabel}</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Message..."
            placeholderTextColor={theme.fgMuted}
            multiline
            maxLength={4000}
            editable={!isActive}
          />
          {isActive ? (
            <TouchableOpacity style={styles.interruptBtn} onPress={() => onInterrupt(session.thread_id)}>
              <Text style={styles.interruptText}>■</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!input.trim() || sending}
            >
              <Text style={styles.sendText}>↑</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Model Picker Modal */}
      <Modal visible={showModelPicker} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowModelPicker(false)}>
          <View style={styles.picker}>
            <Text style={styles.pickerTitle}>Select Model</Text>
            {MODELS.map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.pickerOption, model === m && styles.pickerOptionSelected]}
                onPress={() => { setModel(m); setShowModelPicker(false); }}
              >
                <View style={styles.pickerRow}>
                  <View style={[styles.pickerRadio, model === m && styles.pickerRadioSelected]} />
                  <Text style={styles.pickerOptionText}>{m}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Permission Picker Modal */}
      <Modal visible={showPermPicker} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowPermPicker(false)}>
          <View style={styles.picker}>
            <Text style={styles.pickerTitle}>Permission Mode</Text>
            {PERMISSION_MODES.map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.pickerOption, session.permission_mode === m && styles.pickerOptionSelected]}
                onPress={() => { onChangePermission(session.thread_id, m); setShowPermPicker(false); }}
              >
                <View style={styles.pickerRow}>
                  <View style={[styles.pickerRadio, session.permission_mode === m && styles.pickerRadioSelected]} />
                  <Text style={styles.pickerOptionText}>{m}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },

  // Input spinner
  inputSpinner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 6,
    backgroundColor: theme.surface,
    borderTopWidth: 1, borderTopColor: theme.border,
  },
  inputSpinnerChar: {
    fontFamily: 'monospace', fontSize: 13, fontWeight: '700', color: theme.yellow,
  },
  inputSpinnerLabel: {
    fontFamily: 'monospace', fontSize: 11, color: theme.yellow,
  },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: theme.surface,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  backBtn: { marginRight: 14 },
  backText: { color: theme.accent, fontSize: 22, lineHeight: 28 },
  headerCenter: { flex: 1 },
  headerTitle: { color: theme.fg, fontSize: 15, fontWeight: '700', fontFamily: 'monospace' },
  headerCwd: { color: theme.fgDim, fontSize: 11, marginTop: 2 },
  permBtn: {
    backgroundColor: theme.surfaceAlt, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: theme.border,
  },
  permBtnText: { color: theme.fgDim, fontSize: 11, fontWeight: '600' },

  // Messages
  messageList: { paddingVertical: 16 },

  // Input area
  inputArea: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 12, paddingTop: 10,
    backgroundColor: theme.surface,
    borderTopWidth: 1, borderTopColor: theme.border,
    gap: 8,
  },
  modelBtn: {
    backgroundColor: theme.surfaceAlt, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 10,
    borderWidth: 1, borderColor: theme.border,
    alignSelf: 'flex-end', marginBottom: 1,
  },
  modelBtnText: { color: theme.accent, fontSize: 11, fontWeight: '600' },
  input: {
    flex: 1,
    backgroundColor: theme.bg, borderColor: theme.border, borderWidth: 1,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11,
    color: theme.fg, fontSize: 15, maxHeight: 120,
  },
  sendBtn: {
    backgroundColor: theme.green, borderRadius: 12,
    width: 42, height: 42,
    justifyContent: 'center', alignItems: 'center',
    alignSelf: 'flex-end',
  },
  sendBtnDisabled: { backgroundColor: theme.surfaceAlt },
  sendText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  interruptBtn: {
    backgroundColor: theme.red, borderRadius: 12,
    width: 42, height: 42,
    justifyContent: 'center', alignItems: 'center',
    alignSelf: 'flex-end',
  },
  interruptText: { color: '#fff', fontSize: 16 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: theme.overlay, justifyContent: 'center', alignItems: 'center' },
  picker: {
    backgroundColor: theme.surface, borderRadius: 18,
    padding: 20, width: '82%',
    borderWidth: 1, borderColor: theme.border,
  },
  pickerTitle: { color: theme.fg, fontSize: 16, fontWeight: '700', marginBottom: 14 },
  pickerOption: { padding: 12, borderRadius: 10, marginBottom: 4 },
  pickerOptionSelected: { backgroundColor: theme.greenBg },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pickerRadio: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2, borderColor: theme.border,
  },
  pickerRadioSelected: { borderColor: theme.green, backgroundColor: theme.green },
  pickerOptionText: { color: theme.fg, fontSize: 14 },
});

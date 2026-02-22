import React, { useState } from 'react';
import {
  Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { PermissionMode, Session } from '../types';
import { theme } from '../theme';

const PERMISSION_MODES: PermissionMode[] = ['default', 'acceptEdits', 'bypassPermissions', 'dontAsk'];
const PERMISSION_LABELS: Record<PermissionMode, string> = {
  default: 'Default (prompt for dangerous ops)',
  acceptEdits: 'Accept Edits (auto-approve file edits)',
  bypassPermissions: 'Bypass All (approve everything)',
  dontAsk: "Don't Ask (skip prompts, log only)",
};

interface Props {
  sessions: Session[];
  onCreateSession: (cwd: string, mode: PermissionMode) => Promise<void>;
  onOpenSession: (session: Session) => void;
  onDeleteSession: (thread_id: string) => Promise<void>;
}

export function SessionsScreen({ sessions, onCreateSession, onOpenSession, onDeleteSession }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [cwd, setCwd] = useState('~/Desktop');
  const [permMode, setPermMode] = useState<PermissionMode>('default');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await onCreateSession(cwd, permMode);
      setShowModal(false);
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setCreating(false);
    }
  };

  const handleDeletePress = (session: Session) => {
    const hasActiveTurn = !!session.active_turn_id;
    Alert.alert(
      'Delete Session',
      `#${session.thread_id.slice(0, 8)}\n${session.cwd}${hasActiveTurn ? '\n\nThis will interrupt the active turn.' : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDeleteSession(session.thread_id),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.list}>
        {sessions.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyText}>No sessions yet</Text>
            <Text style={styles.emptyHint}>Create a new session to start chatting</Text>
          </View>
        )}
        {sessions.map(session => (
          <TouchableOpacity
            key={session.thread_id}
            style={styles.card}
            onPress={() => onOpenSession(session)}
            activeOpacity={0.8}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.threadId}>#{session.thread_id.slice(0, 8)}</Text>
              <View style={styles.cardHeaderRight}>
                <View style={[styles.badge, { backgroundColor: permBadgeColor(session.permission_mode) }]}>
                  <Text style={styles.badgeText}>{session.permission_mode}</Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDeletePress(session)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.deleteBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.cwd} numberOfLines={1}>{session.cwd}</Text>
            <View style={styles.cardFooter}>
              <Text style={styles.msgCount}>{session.messages.length} messages</Text>
              {session.active_turn_id && (
                <View style={styles.activeBadge}>
                  <View style={styles.activeDot} />
                  <Text style={styles.activeBadgeText}>Active</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => setShowModal(true)}>
        <Text style={styles.fabText}>+ New Session</Text>
      </TouchableOpacity>

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>New Session</Text>

            <Text style={styles.inputLabel}>Working Directory</Text>
            <TextInput
              style={styles.input}
              value={cwd}
              onChangeText={setCwd}
              placeholder="/tmp"
              placeholderTextColor={theme.fgMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.inputLabel}>Permission Mode</Text>
            {PERMISSION_MODES.map(mode => (
              <TouchableOpacity
                key={mode}
                style={[styles.modeOption, permMode === mode && styles.modeOptionSelected]}
                onPress={() => setPermMode(mode)}
              >
                <View style={styles.modeRow}>
                  <View style={[styles.radio, permMode === mode && styles.radioSelected]} />
                  <Text style={styles.modeText}>{PERMISSION_LABELS[mode]}</Text>
                </View>
              </TouchableOpacity>
            ))}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createBtn, creating && styles.btnDisabled]}
                onPress={handleCreate}
                disabled={creating}
              >
                <Text style={styles.createText}>{creating ? 'Creating...' : 'Create'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function permBadgeColor(mode: PermissionMode) {
  return {
    default: theme.accent,
    acceptEdits: theme.green,
    bypassPermissions: theme.purple,
    dontAsk: theme.fgDimmer,
  }[mode];
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  list: { padding: 16, paddingBottom: 96 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { color: theme.fg, fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptyHint: { color: theme.fgDim, fontSize: 14 },

  card: {
    backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1,
    borderRadius: 14, padding: 16, marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 8,
  },
  cardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  threadId: { color: theme.fgDim, fontSize: 12, fontFamily: 'monospace' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  deleteBtn: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: theme.redBg,
    justifyContent: 'center', alignItems: 'center',
  },
  deleteBtnText: { color: theme.red, fontSize: 11, fontWeight: '700' },
  cwd: { color: theme.fg, fontSize: 14, marginBottom: 8 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  msgCount: { color: theme.fgDim, fontSize: 12 },
  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.green },
  activeBadgeText: { color: theme.green, fontSize: 12, fontWeight: '600' },

  fab: {
    position: 'absolute', bottom: 24, left: 24, right: 24,
    backgroundColor: theme.green, borderRadius: 14, padding: 16, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
    elevation: 6,
  },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: theme.overlay, justifyContent: 'flex-end' },
  modal: {
    backgroundColor: theme.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    padding: 24, borderTopWidth: 1, borderColor: theme.border,
  },
  modalTitle: { color: theme.fg, fontSize: 20, fontWeight: '700', marginBottom: 20 },
  inputLabel: { color: theme.fgDim, fontSize: 13, marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: theme.bg, borderColor: theme.border, borderWidth: 1,
    borderRadius: 10, padding: 13, color: theme.fg, fontSize: 14,
  },
  modeOption: {
    borderRadius: 8, padding: 12, marginBottom: 4,
    borderWidth: 1, borderColor: 'transparent',
  },
  modeOptionSelected: { borderColor: theme.green, backgroundColor: theme.greenBg },
  modeRow: { flexDirection: 'row', alignItems: 'center' },
  radio: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2, borderColor: theme.border, marginRight: 10,
  },
  radioSelected: { borderColor: theme.green, backgroundColor: theme.green },
  modeText: { color: theme.fg, fontSize: 13, flex: 1 },
  modalActions: { flexDirection: 'row', marginTop: 24, gap: 12 },
  cancelBtn: {
    flex: 1, backgroundColor: theme.surfaceAlt, borderRadius: 10,
    padding: 14, alignItems: 'center',
  },
  cancelText: { color: theme.fg, fontWeight: '600' },
  createBtn: {
    flex: 1, backgroundColor: theme.green, borderRadius: 10,
    padding: 14, alignItems: 'center',
  },
  createText: { color: '#fff', fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
});

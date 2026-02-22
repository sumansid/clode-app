import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PermissionDenial, PermissionMode } from '../types';
import { theme } from '../theme';

interface Props {
  denials?: PermissionDenial[];
  onApprove: (mode: PermissionMode) => void;
  onDismiss: () => void;
}

const TOOL_ICONS: Record<string, string> = {
  Bash: '$',
  Write: '+',
  Edit: '~',
  Read: '>',
  Glob: '*',
  Grep: '/',
};

function summarizeDenial(d: PermissionDenial): { icon: string; label: string; detail: string } {
  const icon = TOOL_ICONS[d.tool_name] ?? '?';
  const input = d.tool_input as Record<string, unknown> | undefined;

  switch (d.tool_name) {
    case 'Bash': {
      const cmd = input?.command as string | undefined;
      return { icon, label: 'Bash', detail: cmd ? truncate(cmd, 80) : 'run a command' };
    }
    case 'Write': {
      const fp = input?.file_path as string | undefined;
      return { icon, label: 'Write', detail: fp ? shortPath(fp) : 'create a file' };
    }
    case 'Edit': {
      const fp = input?.file_path as string | undefined;
      return { icon, label: 'Edit', detail: fp ? shortPath(fp) : 'edit a file' };
    }
    case 'Read': {
      const fp = input?.file_path as string | undefined;
      return { icon, label: 'Read', detail: fp ? shortPath(fp) : 'read a file' };
    }
    default:
      return { icon, label: d.tool_name, detail: input ? truncate(JSON.stringify(input), 60) : '' };
  }
}

function shortPath(p: string): string {
  const home = p.replace(/^\/Users\/[^/]+/, '~');
  return home.length > 60 ? '...' + home.slice(-57) : home;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 3) + '...' : s;
}

export function PermissionBanner({ denials, onApprove, onDismiss }: Props) {
  const items = (denials ?? []).map(summarizeDenial);

  return (
    <View style={styles.banner}>
      <View style={styles.header}>
        <Text style={styles.icon}>🔒</Text>
        <Text style={styles.title}>
          {items.length} tool{items.length !== 1 ? 's' : ''} blocked
        </Text>
        <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.dismissX}>✕</Text>
        </TouchableOpacity>
      </View>

      {items.length > 0 ? (
        <View style={styles.denialList}>
          {items.map((it, i) => (
            <View key={i} style={styles.denialRow}>
              <View style={styles.toolBadge}>
                <Text style={styles.toolIcon}>{it.icon}</Text>
              </View>
              <View style={styles.denialInfo}>
                <Text style={styles.toolName}>{it.label}</Text>
                {it.detail ? <Text style={styles.toolDetail} numberOfLines={2}>{it.detail}</Text> : null}
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.subtitle}>
          Claude needs elevated permissions to complete this action.
        </Text>
      )}

      <Text style={styles.hint}>Approve and retry with:</Text>

      <View style={styles.buttons}>
        <TouchableOpacity style={styles.acceptBtn} onPress={() => onApprove('acceptEdits')}>
          <Text style={styles.acceptLabel}>Accept Edits</Text>
          <Text style={styles.acceptSub}>file read/write</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bypassBtn} onPress={() => onApprove('bypassPermissions')}>
          <Text style={styles.bypassLabel}>Allow All</Text>
          <Text style={styles.bypassSub}>bypass all checks</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: theme.yellowBg,
    borderColor: theme.yellow,
    borderWidth: 1,
    borderRadius: 14,
    margin: 12,
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  icon: { fontSize: 16 },
  title: { color: theme.yellow, fontWeight: '700', fontSize: 14, flex: 1 },
  dismissX: { color: theme.fgMuted, fontSize: 14, fontWeight: '700' },
  denialList: { gap: 6, marginBottom: 12 },
  denialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.bg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 8,
  },
  toolBadge: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: theme.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolIcon: { color: theme.yellow, fontSize: 14, fontWeight: '700', fontFamily: 'monospace' },
  denialInfo: { flex: 1 },
  toolName: { color: theme.fg, fontSize: 12, fontWeight: '700' },
  toolDetail: { color: theme.fgDim, fontSize: 11, fontFamily: 'monospace', marginTop: 2 },
  subtitle: {
    color: theme.fgDim,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  hint: {
    color: theme.fgDim,
    fontSize: 11,
    marginBottom: 10,
  },
  buttons: { flexDirection: 'row', gap: 8 },
  acceptBtn: {
    flex: 1,
    backgroundColor: theme.greenBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.green,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  acceptLabel: { color: theme.green, fontWeight: '700', fontSize: 13 },
  acceptSub: { color: theme.fgMuted, fontSize: 10, marginTop: 2 },
  bypassBtn: {
    flex: 1,
    backgroundColor: theme.purpleBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.purple,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  bypassLabel: { color: theme.pink, fontWeight: '700', fontSize: 13 },
  bypassSub: { color: theme.fgMuted, fontSize: 10, marginTop: 2 },
});

import { CameraView, useCameraPermissions } from "expo-camera";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { ConnectionStatus } from "../types";
import { theme, palette } from "../theme";

interface Props {
  status: ConnectionStatus;
  lastError: string | null;
  url: string;
  onConnect: (url: string) => void;
  onDisconnect: () => void;
}

export function ConnectScreen({
  status,
  lastError,
  url,
  onConnect,
  onDisconnect,
}: Props) {
  const [inputUrl, setInputUrl] = useState(url);
  const [pairKey, setPairKey] = useState("");
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);

  // Reset scan lock when modal closes
  useEffect(() => {
    if (!scanning) scannedRef.current = false;
  }, [scanning]);

  const handleScanPress = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) return;
    }
    setScanning(true);
  };

  /** Build the connect URL, appending ?key= if the user entered one manually */
  const buildConnectUrl = (base: string, key: string): string => {
    if (!key) return base;
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}key=${key}`;
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scannedRef.current) return;
    if (!data.startsWith("ws://") && !data.startsWith("wss://")) return;
    scannedRef.current = true;

    // Extract key from QR URL so it shows in the pair key field
    try {
      const qrUrl = new URL(data);
      const qrKey = qrUrl.searchParams.get("key") ?? "";
      // Strip the key param from the display URL
      qrUrl.searchParams.delete("key");
      const cleanUrl = qrUrl.toString();
      setInputUrl(cleanUrl);
      setPairKey(qrKey);
      setScanning(false);
      setTimeout(() => onConnect(data), 300);
    } catch {
      setInputUrl(data);
      setScanning(false);
      setTimeout(() => onConnect(data), 300);
    }
  };

  const canEdit = status !== "connecting" && status !== "connected";

  const statusColor = {
    disconnected: theme.fgDimmer,
    connecting: theme.yellow,
    connected: theme.green,
    error: theme.red,
  }[status];

  const statusLabel = {
    disconnected: "Disconnected",
    connecting: "Connecting...",
    connected: "Connected",
    error: "Connection error",
  }[status];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>clode</Text>

      <View style={styles.statusRow}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={[styles.statusText, { color: statusColor }]}>
          {statusLabel}
        </Text>
        {status === "connecting" && (
          <ActivityIndicator
            size="small"
            color={statusColor}
            style={{ marginLeft: 6 }}
          />
        )}
      </View>

      {/* Error message */}
      {lastError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{lastError}</Text>
        </View>
      )}

      {/* URL + QR row */}
      <Text style={styles.label}>server</Text>
      <View style={styles.urlRow}>
        <TextInput
          style={styles.urlInput}
          value={inputUrl}
          onChangeText={setInputUrl}
          placeholder="ws://localhost:3284"
          placeholderTextColor={theme.fgMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          editable={canEdit}
        />
        {canEdit && (
          <TouchableOpacity style={styles.qrBtn} onPress={handleScanPress}>
            <Text style={styles.qrBtnText}>⬡</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Pair key — compact inline */}
      <View style={styles.pairRow}>
        <Text style={styles.label}>pair code</Text>
        <TextInput
          style={styles.pairInput}
          value={pairKey}
          onChangeText={setPairKey}
          placeholder="------"
          placeholderTextColor={theme.fgMuted}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={6}
          editable={canEdit}
        />
      </View>

      <Text style={styles.hint}>
        Run <Text style={styles.code}>claude-app-server start</Text> to get a QR
        code
      </Text>

      {status === "connected" ? (
        <TouchableOpacity
          style={[styles.button, styles.disconnectButton]}
          onPress={onDisconnect}
        >
          <Text style={styles.buttonText}>Disconnect</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[
            styles.button,
            status === "connecting" && styles.buttonDisabled,
          ]}
          onPress={() => onConnect(buildConnectUrl(inputUrl, pairKey))}
          disabled={status === "connecting"}
        >
          <Text style={styles.buttonText}>Connect</Text>
        </TouchableOpacity>
      )}

      {/* QR Scanner Modal */}
      <Modal
        visible={scanning}
        animationType="slide"
        onRequestClose={() => setScanning(false)}
      >
        <View style={styles.scannerContainer}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={handleBarcodeScanned}
          />

          {/* Overlay */}
          <View style={styles.overlay}>
            <View style={styles.overlayTop} />
            <View style={styles.overlayMiddle}>
              <View style={styles.overlaySide} />
              <View style={styles.scanWindow}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
              </View>
              <View style={styles.overlaySide} />
            </View>
            <View style={styles.overlayBottom}>
              <Text style={styles.scanLabel}>Point at the QR code from</Text>
              <Text style={styles.scanCommand}>claude-app-server start</Text>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setScanning(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const WINDOW_SIZE = 220;
const CORNER_SIZE = 20;
const CORNER_WIDTH = 3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
    justifyContent: "center",
    padding: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: theme.fg,
    fontFamily: "monospace",
    textAlign: "center",
    marginBottom: 6,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  statusText: { fontSize: 12, fontWeight: "600", fontFamily: "monospace" },

  errorBox: {
    backgroundColor: theme.redBg,
    borderWidth: 1,
    borderColor: theme.red,
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  errorText: {
    color: theme.red,
    fontSize: 11,
    fontFamily: "monospace",
    lineHeight: 16,
  },

  label: {
    color: theme.fgDimmer,
    fontSize: 11,
    fontFamily: "monospace",
    marginBottom: 6,
    textTransform: "lowercase",
  },

  // URL row
  urlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  urlInput: {
    flex: 1,
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.fg,
    fontSize: 13,
    fontFamily: "monospace",
  },
  qrBtn: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 8,
    width: 42,
    height: 42,
    justifyContent: "center",
    alignItems: "center",
  },
  qrBtnText: { fontSize: 18, color: theme.fgDim },

  // Pair key — compact row: label left, input right
  pairRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  pairInput: {
    flex: 1,
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: palette.dragonYellow,
    fontSize: 15,
    fontFamily: "monospace",
    fontWeight: "700",
    letterSpacing: 6,
    textAlign: "center",
  },

  hint: {
    color: theme.fgMuted,
    fontSize: 11,
    marginBottom: 18,
    lineHeight: 16,
    fontFamily: "monospace",
  },
  code: { color: theme.link },

  button: {
    backgroundColor: theme.green,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.5 },
  disconnectButton: { backgroundColor: theme.red },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  // Scanner
  scannerContainer: { flex: 1, backgroundColor: "#000" },
  overlay: { flex: 1 },
  overlayTop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  overlayMiddle: { flexDirection: "row", height: WINDOW_SIZE },
  overlaySide: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  scanWindow: { width: WINDOW_SIZE, height: WINDOW_SIZE },
  overlayBottom: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    paddingTop: 20,
    gap: 4,
  },
  scanLabel: { color: theme.fgDim, fontSize: 13 },
  scanCommand: {
    color: theme.link,
    fontSize: 13,
    fontFamily: "monospace",
    fontWeight: "600",
  },
  cancelBtn: {
    marginTop: 20,
    backgroundColor: theme.surfaceAlt,
    borderRadius: 8,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cancelText: { color: theme.fg, fontWeight: "600", fontSize: 14 },

  // Corner brackets
  corner: {
    position: "absolute",
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: theme.accent,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderTopRightRadius: 4,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderBottomLeftRadius: 4,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderBottomRightRadius: 4,
  },
});

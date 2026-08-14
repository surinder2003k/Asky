import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Keyboard, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as LocalAuthentication from "expo-local-authentication";

import { IconSymbol } from "@/components/ui/icon-symbol";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/use-colors";
import { getAppLockEnabled } from "@/lib/storage";

const PIN_STORAGE_KEY = "asky:applock:pin";

/**
 * App Lock overlay.
 * - Enabled via Settings toggle ("App Lock").
 * - Supports biometric (fingerprint/Face ID) where available; PIN is always available as fallback.
 * - Shows when the app comes back to the foreground after the lock was enabled.
 */
export function AppLock() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [storedPin, setStoredPin] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const lockedRef = useRef(false);
  const lastAppForeground = useRef(Date.now());

  // Track foreground state: lock when returning from background
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        const gap = Date.now() - lastAppForeground.current;
        lastAppForeground.current = Date.now();
        if (lockedRef.current && gap > 1500) {
          setLocked(true);
          tryUnlockAsync().catch(() => {});
        }
      } else {
        lastAppForeground.current = Date.now();
      }
    });
    return () => sub.remove();
  }, []);

  const unlockIfEnabled = useCallback(async () => {
    const enabled = await getAppLockEnabled();
    lockedRef.current = enabled;
    if (enabled) {
      setLocked(true);
      await tryUnlockAsync();
    } else {
      setLocked(false);
    }
  }, []);

  // On mount, check whether lock is enabled
  useEffect(() => {
    (async () => {
      const enabled = await getAppLockEnabled();
      lockedRef.current = enabled;
      setLocked(enabled);
      if (enabled) {
        const stored = await readStoredPin();
        setStoredPin(stored);
        tryUnlockAsync().catch(() => {});
      }
    })();
  }, []);

  const readStoredPin = useCallback(async (): Promise<string | null> => {
    try {
      const AsyncStorage = await import("@react-native-async-storage/async-storage");
      return await AsyncStorage.default.getItem(PIN_STORAGE_KEY);
    } catch {
      return null;
    }
  }, []);

  const savePin = useCallback(async (value: string): Promise<void> => {
    try {
      const AsyncStorage = await import("@react-native-async-storage/async-storage");
      await AsyncStorage.default.setItem(PIN_STORAGE_KEY, value);
    } catch {
      // non-fatal: PIN simply not persisted this time
    }
  }, []);

  const tryUnlockAsync = useCallback(async () => {
    if (!lockedRef.current) return;
    try {
      // Web has no local authentication — go straight to the PIN path
      if (Platform.OS === "web") {
        const stored = await readStoredPin();
        setStoredPin(stored);
        if (!stored) {
          // First time: instant unlock, prompt to set a PIN
          setLocked(false);
          setError("");
        }
        return;
      }
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (hasHardware && isEnrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Unlock Asky",
          fallbackLabel: "Use PIN",
          disableDeviceFallback: false,
          cancelLabel: "Cancel",
        });
        if (result.success) {
          setLocked(false);
          setError("");
          return;
        }
      }
      // No biometric path: PIN only
      const stored = await readStoredPin();
      setStoredPin(stored);
      if (!stored) {
        // First time: allow instant unlock, prompt to set PIN below
        setLocked(false);
        setError("");
      }
    } catch {
      // ignore — keep locked
    }
  }, []);

  if (!locked) return null;

  const onPinChar = (ch: string) => {
    setError("");
    if (ch.length > 6) return;
    setPin(ch);
    if (!storedPin) return;
    if (ch.length === storedPin.length) {
      setUnlocking(true);
      setTimeout(() => {
        if (ch === storedPin) {
          setLocked(false);
          setError("");
        } else {
          setError("Wrong PIN");
          setPin("");
        }
        setUnlocking(false);
      }, 120);
    }
  };

  const biometricAvailable = Platform.OS !== "web";

  return (
    <Modal visible={locked} transparent animationType="fade" statusBarTranslucent>
      <View
        style={[
          styles.screen,
          {
            backgroundColor: "#0d0f10",
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <View style={styles.center}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primary + "22" }]}>
            <IconSymbol name="lock.fill" size={36} color={colors.primary} />
          </View>
          <Text style={styles.title}>Asky is locked</Text>
          <Text style={styles.subtitle}>Unlock to continue your chats</Text>

          {biometricAvailable && !unlocking && (
            <Pressable
              onPress={async () => {
                try {
                  const hasHardware = await LocalAuthentication.hasHardwareAsync();
                  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
                  if (hasHardware && isEnrolled) {
                    const result = await LocalAuthentication.authenticateAsync({
                      promptMessage: "Unlock Asky",
                      fallbackLabel: "Use PIN",
                      cancelLabel: "Cancel",
                    });
                    if (result.success) {
                      setLocked(false);
                      setError("");
                    }
                  }
                } catch {
                  // ignore
                }
              }}
              style={({ pressed }) => [styles.bioBtn, { backgroundColor: colors.primary }, pressed && { opacity: 0.8 }]}
            >
              <IconSymbol name="touchid" size={18} color="#fff" />
              <Text style={styles.bioBtnText}>Unlock with biometric</Text>
            </Pressable>
          )}

          <View style={styles.pinSection}>
            <Text style={styles.pinLabel}>{storedPin ? "Enter PIN" : "Set a PIN to protect the app"}</Text>
            <TextInput
              value={pin}
              onChangeText={onPinChar}
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry
              placeholder="• • • •"
              placeholderTextColor={colors.muted}
              style={[styles.pinInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              onKeyPress={({ nativeEvent }) => {
                if (nativeEvent.key === "Backspace") {
                  onPinChar(pin.slice(0, -1));
                  return true;
                }
                return false;
              }}
            />
            {storedPin && pin.length > 0 && pin.length < storedPin.length && (
              <Text style={styles.pinHint}>{pin.length} / {storedPin.length}</Text>
            )}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {!storedPin && pin.length >= 4 && (
              <Pressable
                onPress={async () => {
                  await savePin(pin);
                  setStoredPin(pin);
                  setError("");
                  try {
                    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  } catch { /* web */ }
                }}
                style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }]}
              >
                <Text style={styles.saveBtnText}>Save PIN</Text>
              </Pressable>
            )}
          </View>

          <Pressable onPress={Keyboard.dismiss} style={styles.skipWrap}>
            <Text style={styles.skip}>Hide keyboard</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 12 },
  iconCircle: { width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center" },
  title: { color: "#fff", fontSize: 24, fontWeight: "700", marginTop: 4 },
  subtitle: { color: "#9BA1A6", fontSize: 14, textAlign: "center" },
  bioBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999, marginTop: 8 },
  bioBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  pinSection: { alignItems: "center", gap: 8, width: "100%", marginTop: 8 },
  pinLabel: { color: "#ECEDEE", fontSize: 13, fontWeight: "600" },
  pinInput: {
    width: 220,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    textAlign: "center",
    fontSize: 22,
    letterSpacing: 8,
  },
  pinHint: { color: "#9BA1A6", fontSize: 12 },
  error: { color: "#F87171", fontSize: 13, fontWeight: "600" },
  success: { color: "#4ADE80", fontSize: 12, textAlign: "center" },
  saveBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999, backgroundColor: "#176B47", marginTop: 4 },
  saveBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  skipWrap: { marginTop: 12 },
  skip: { color: "#9BA1A6", fontSize: 13 },
});

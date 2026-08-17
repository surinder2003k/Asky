import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Keyboard, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as LocalAuthentication from "expo-local-authentication";

import { IconSymbol } from "@/components/ui/icon-symbol";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/use-colors";

const PIN_STORAGE_KEY = "asky:applock:pin";

function safeHaptic() {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    /* web */
  }
}

/**
 * Professional App Lock overlay (phone-lock style):
 * - When the user turns ON "App Lock" in Settings without a PIN, the lock
 *   screen immediately requires creating a 4–6 digit PIN before the app can
 *   be used (no instant-unlock escape).
 * - The app locks when it goes to the background, and the lock sheet shows
 *   immediately when the app returns (foreground) or is minimized again.
 * - Biometric unlock first when enrolled; PIN is the reliable fallback.
 */
export function AppLock() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [locked, setLocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null); // PIN being set (first entry)
  const [storedPin, setStoredPin] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const lockedRef = useRef(false);
  const confirmRef = useRef<string | null>(null);
  const wasActive = useRef(true);

  // ---- Load lock state on mount -------------------------------------------
  useEffect(() => {
    (async () => {
      const { getAppLockEnabled } = await import("@/lib/storage");
      const enabled = await getAppLockEnabled();
      lockedRef.current = enabled;
      const stored = await readStoredPin();
      setStoredPin(stored);
      // If lock is enabled but no PIN exists yet, force PIN setup flow.
      if (enabled && !stored) {
        setLocked(true);
        setConfirm(null);
      } else {
        setLocked(false);
      }
      setReady(enabled);
      setLoaded(true);
      // Auto biometric on first open only if a PIN already exists.
      if (enabled && stored) {
        tryUnlockAsync().catch(() => {});
      }
    })();
  }, []);

  // ---- Lock on background, unlock sheet on foreground ----------------------
  useEffect(() => {
    if (!loaded) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        wasActive.current = false;
        if (lockedRef.current) {
          lockedRef.current = true; // stays locked
          setLocked(true);
        }
        return;
      }
      if (wasActive.current) return; // ignore initial mount event
      wasActive.current = true;
      if (lockedRef.current) {
        setLocked(true);
        tryUnlockAsync().catch(() => {});
      }
    });
    return () => sub.remove();
  }, [loaded]);

  const readStoredPin = useCallback(async () => {
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
    if (Platform.OS === "web") return; // web goes straight to PIN path
    try {
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
          safeHaptic();
          return;
        }
      }
    } catch {
      // ignore — keep locked
    }
  }, []);

  if (!locked) return null;

  const submitting = confirm !== null; // PIN setup mode
  const isConfirming = submitting && storedPin === null && confirmRef.current !== null;

  const finishSetup = useCallback(
    async (value: string) => {
      await savePin(value);
      setStoredPin(value);
      setConfirm(null);
      confirmRef.current = null;
      setPin("");
      setError("");
      try {
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch {
        /* web */
      }
      // PIN set: stay locked until the user unlocks with it / biometric.
    },
    [savePin],
  );

  const onPinChar = (ch: string) => {
    setError("");
    if (ch.length > 6) return;
    setPin(ch);
    if (!submitting) {
      // ---- Unlock mode: compare against stored PIN as the user types --------
      const target = storedPin;
      if (!target) return;
      if (ch.length === target.length) {
        setUnlocking(true);
        setTimeout(() => {
          if (ch === target) {
            setLocked(false);
            setError("");
            setPin("");
            safeHaptic();
          } else {
            try {
              if (Platform.OS !== "web") {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              }
            } catch {
              /* web */
            }
            setError("Wrong PIN — try again");
            setPin("");
          }
          setUnlocking(false);
        }, 150);
      }
      return;
    }
    // ---- Setup mode: require entering the same PIN twice ---------------------
    if (isConfirming) {
      if (ch.length === confirmRef.current!.length) {
        setTimeout(() => {
          if (ch === confirmRef.current) {
            finishSetup(ch);
          } else {
            try {
              if (Platform.OS !== "web") {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              }
            } catch {
              /* web */
            }
            setError("PINs don't match — type it again");
            setPin("");
            confirmRef.current = null;
            setConfirm("confirm");
          }
          setUnlocking(false);
        }, 150);
      }
      return;
    }
    if (ch.length >= 4) {
      // First entry done: remember it and ask for confirmation.
      confirmRef.current = ch;
      setConfirm("confirm");
      setPin("");
      setError("");
    }
  };

  const biometricAvailable = Platform.OS !== "web";

  const titleText = !storedPin ? "Set up App Lock" : "Asky is locked";
  const subtitleText = !storedPin
    ? "Create a 4–6 digit PIN to protect your chats"
    : "Enter your PIN or use biometrics to unlock";

  return (
    <Modal visible={locked} transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View
        style={[
          styles.screen,
          {
            backgroundColor: "rgba(5, 7, 8, 0.97)",
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <View style={styles.center}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primary + "26" }]}>
            <IconSymbol name="lock.fill" size={34} color={colors.primary} />
          </View>
          <Text style={styles.title}>{titleText}</Text>
          <Text style={styles.subtitle}>{subtitleText}</Text>

          {biometricAvailable && storedPin && !unlocking && (
            <Pressable
              onPress={async () => {
                safeHaptic();
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
                      safeHaptic();
                    }
                  }
                } catch {
                  // ignore
                }
              }}
              style={({ pressed }) => [styles.bioBtn, { backgroundColor: colors.primary + "22", borderColor: colors.primary + "66", borderWidth: 1 }, pressed && { opacity: 0.8 }]}
            >
              <IconSymbol name="touchid" size={18} color={colors.primary} />
              <Text style={[styles.bioBtnText, { color: colors.primary }]}>Use fingerprint</Text>
            </Pressable>
          )}

          <View style={styles.pinSection}>
            <Text style={styles.pinLabel}>
              {!storedPin
                ? isConfirming
                  ? "Confirm your PIN"
                  : "Create PIN (4–6 digits)"
                : "PIN"}
            </Text>
            <TextInput
              value={pin}
              onChangeText={onPinChar}
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry
              placeholder="• • • •"
              placeholderTextColor={colors.muted}
              autoFocus
              style={[
                styles.pinInput,
                {
                  color: colors.foreground,
                  borderColor: error ? "#F87171" : colors.border,
                  backgroundColor: colors.background,
                },
                unlocking && styles.pinInputShake,
              ]}
              onKeyPress={({ nativeEvent }) => {
                if (nativeEvent.key === "Backspace") {
                  onPinChar(pin.slice(0, -1));
                  return true;
                }
                return false;
              }}
            />
            {!storedPin && pin.length > 0 && pin.length < 4 && <Text style={styles.pinHint}>{pin.length} / 4 minimum</Text>}
            {storedPin && pin.length > 0 && pin.length < storedPin.length && (
              <Text style={styles.pinHint}>{pin.length} / {storedPin.length}</Text>
            )}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {submitting && !isConfirming && pin.length === 0 && !confirmRef.current && (
              <Text style={styles.success}>PIN saved. Now unlock the app.</Text>
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
  subtitle: { color: "#9BA1A6", fontSize: 14, textAlign: "center", lineHeight: 20 },
  bioBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999, marginTop: 8 },
  bioBtnText: { fontWeight: "600", fontSize: 15 },
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
  pinInputShake: { transform: [{ translateX: -4 }] },
  pinHint: { color: "#9BA1A6", fontSize: 12 },
  error: { color: "#F87171", fontSize: 13, fontWeight: "600" },
  success: { color: "#4ADE80", fontSize: 12, textAlign: "center" },
  skipWrap: { marginTop: 12 },
  skip: { color: "#9BA1A6", fontSize: 13 },
});

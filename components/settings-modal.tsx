import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { PROVIDERS } from "@/lib/providers";
import {
  getApiKey,
  setApiKey,
  setSettings,
  getCustomSystemPrompt,
  setCustomSystemPrompt,
  exportAllChats,
  importChats,
  getUsageStats,
  resetUsageStats,
} from "@/lib/storage";
import { FONT_SIZES, useFontSize } from "@/lib/font-size";
import { MODE_LABELS } from "@/lib/modes";
import { testApiKey } from "@/lib/ai";
import { checkForUpdates, getModels, getCachedVersion } from "@/lib/remote-config";
import {
  getCloudSyncEnabled,
  requestSync,
  setCloudSyncEnabled,
} from "@/lib/cloud-sync";
import { ACCENT_PALETTES, useThemeContext } from "@/lib/theme-provider";
import { ResumeSheet } from "@/components/resume-sheet";
import type { AccentKey, UsageStats } from "@/lib/storage";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

function haptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

interface TestState {
  loading: boolean;
  ok?: boolean;
  message?: string;
}

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
  onImported?: () => void;
}

export function SettingsModal({ visible, onClose, onSaved, onImported }: SettingsModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { colorScheme, setColorScheme, accent, setAccent, colorTheme, setColorTheme } = useThemeContext();
  const { fontSizeChoice, fontSize, setFontSizeChoice } = useFontSize();
  const [modelText, setModelText] = useState("mistral/mistral-small-latest");
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [tests, setTests] = useState<Record<string, TestState>>({});
  const [saving, setSaving] = useState(false);
  const [cloudSyncOn, setCloudSyncOn] = useState(false);
  const [updateState, setUpdateState] = useState<{
    loading: boolean;
    status?: "checking" | "success" | "uptodate" | "error";
    message?: string;
  }>({ loading: false });
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [systemPromptText, setSystemPromptText] = useState("");
  const [exportState, setExportState] = useState<{ loading: boolean; message?: string; ok?: boolean }>({ loading: false });
  const [importState, setImportState] = useState<{ loading: boolean; message?: string; ok?: boolean }>({ loading: false });
  const [prompts, setPrompts] = useState<{ id: string; name: string; text: string }[]>([]);
  const [promptName, setPromptName] = useState("");
  const [promptTextState, setPromptTextState] = useState("");
  const [ttsRate, setTtsRate] = useState(1);
  const [autoReadAloud, setAutoReadAloud] = useState(false);
  const [appLockOn, setAppLockOn] = useState(false);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [presets, setPresets] = useState<{ id: string; name: string; modelKey: string; chatMode?: string }[]>([]);
  const [presetSaveMsg, setPresetSaveMsg] = useState<string | null>(null);
  const [webSearchOn, setWebSearchOn] = useState(false);
  const [kbDocs, setKbDocs] = useState<{ id: string; name: string; text: string; active: boolean }[]>([]);
  const [kbMsg, setKbMsg] = useState<string | null>(null);
  const [resumeOpen, setResumeOpen] = useState(false);

  const COLOR_THEMES = {
    default: { sample: colorScheme === "dark" ? "#1e2022" : "#f5f5f5" },
    oled: { sample: "#000000" },
    sepia: { sample: "#e8dcc5" },
  };
  type ColorThemeKey = "default" | "oled" | "sepia";

  const loadUsageStats = useCallback(() => {
    getUsageStats().then(setUsageStats);
  }, []);

  const setColorThemeLocal = useCallback(
    (theme: ColorThemeKey) => {
      setColorTheme(theme);
    },
    [setColorTheme],
  );

  useEffect(() => {
    if (!visible) return;
    getCloudSyncEnabled().then(setCloudSyncOn);
    loadUsageStats();
    (async () => {
      const { getSavedPrompts, getTtsPrefs } = await import("@/lib/storage");
      setPrompts(await getSavedPrompts());
      const prefs = await getTtsPrefs();
      setTtsRate(prefs.rate);
      const { getAutoReadAloud } = await import("@/lib/storage");
      setAutoReadAloud(await getAutoReadAloud());
      const { getAppLockEnabled, getModelPresets } = await import("@/lib/storage");
      setAppLockOn(await getAppLockEnabled());
      setPresets(await getModelPresets());
      const { getWebSearchEnabled, getKbDocs } = await import("@/lib/storage");
      setWebSearchOn(await getWebSearchEnabled());
      setKbDocs(await getKbDocs());
    })();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      const k: Record<string, string> = {};
      for (const p of PROVIDERS) k[p.key] = await getApiKey(p.key);
      setSystemPromptText(await getCustomSystemPrompt());
      setKeys(k);
      const models = await getModels();
      const defaultKey = models[0]?.id ?? "mistral/mistral-small-latest";
      setModelText(k.mistral || defaultKey);
      setTests({});
      setCurrentVersion(await getCachedVersion());
    })();
  }, [visible]);

  const setKey = useCallback((providerKey: string, value: string) => {
    setKeys((prev) => ({ ...prev, [providerKey]: value }));
  }, []);

  const handleTest = useCallback(async (providerKey: string) => {
    const apiKey = (keys[providerKey] ?? "").trim();
    if (!apiKey) {
      setTests((prev) => ({ ...prev, [providerKey]: { loading: false, ok: false, message: "Enter a key first" } }));
      return;
    }
    setTests((prev) => ({ ...prev, [providerKey]: { loading: true } }));
    const result = await testApiKey(providerKey, apiKey);
    setTests((prev) => ({ ...prev, [providerKey]: { loading: false, ...result } }));
  }, [keys]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    for (const p of PROVIDERS) {
      await setApiKey(p.key, (keys[p.key] ?? "").trim());
    }
    let modelKey = modelText.trim();
    const trimmed = modelText.trim();
    const models = await getModels();
    if (models.some((m) => m.id === trimmed)) {
      modelKey = trimmed;
    } else {
      const exact = models.find((m) => m.name.toLowerCase() === trimmed.toLowerCase());
      if (exact) modelKey = exact.id;
    }
    await setSettings({ modelKey });
    await setCustomSystemPrompt(systemPromptText);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setSaving(false);
    onSaved?.();
    onClose();
  }, [keys, modelText, systemPromptText, onSaved, onClose]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, top: 0 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: Math.max(insets.bottom, 16) + 8 },
          ]}
        >
          <View className="items-center py-2">
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
          </View>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
            keyboardShouldPersistTaps="handled"
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-xl font-bold text-foreground">Settings</Text>
              <Pressable onPress={onClose} style={({ pressed }) => [pressed && { opacity: 0.6 }]} hitSlop={8}>
                <IconSymbol name="xmark" size={20} color={colors.muted} />
              </Pressable>
            </View>
            <Text className="text-xs text-muted mt-1">
              Add your API keys. Keys are stored only on this device.
            </Text>

            {/* Appearance & sync toggles */}
            <View className="mt-4 gap-3">
              <View className="rounded-xl border border-border bg-background px-3 py-3 flex-row items-center justify-between">
                <View className="flex-row items-center flex-1 pr-2">
                  <IconSymbol
                    name={colorScheme === "dark" ? "moon.fill" : "sun.max.fill"}
                    size={18}
                    color={colors.primary}
                  />
                  <View className="flex-1 ml-2">
                    <Text className="text-sm font-semibold text-foreground">Dark Mode</Text>
                    <Text className="text-[11px] text-muted mt-0.5">
                      {colorScheme === "dark" ? "Dark theme active" : "Light theme active"}
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => {
                    haptic();
                    setColorScheme(colorScheme === "dark" ? "light" : "dark");
                  }}
                  style={({ pressed }) => [
                    styles.testBtn,
                    { backgroundColor: colors.primary + "22" },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text className="text-xs font-semibold" style={{ color: colors.primary }}>
                    {colorScheme === "dark" ? "Light" : "Dark"}
                  </Text>
                </Pressable>
              </View>

              {/* Accent color */}
              <View className="rounded-xl border border-border bg-background px-3 py-3">
                <View className="flex-row items-center">
                  <IconSymbol name="paintbrush.fill" size={18} color={colors.primary} />
                  <View className="flex-1 ml-2">
                    <Text className="text-sm font-semibold text-foreground">Accent Color</Text>
                    <Text className="text-[11px] text-muted mt-0.5">App's highlight color</Text>
                  </View>
                </View>
                <View className="flex-row gap-3 mt-3">
                  {(Object.keys(ACCENT_PALETTES) as AccentKey[]).map((key) => (
                    <Pressable
                      key={key}
                      onPress={() => {
                        haptic();
                        setAccent(key);
                      }}
                      style={({ pressed }) => [pressed && { transform: [{ scale: 0.95 }], opacity: 0.85 }]}
                    >
                      <View
                        className="items-center justify-center rounded-full"
                        style={{
                          width: 40,
                          height: 40,
                          backgroundColor: colorScheme === "dark" ? ACCENT_PALETTES[key].dark : ACCENT_PALETTES[key].light,
                          borderWidth: accent === key ? 3 : 0,
                          borderColor: colors.foreground,
                        }}
                      >
                        {accent === key ? (
                          <IconSymbol name="checkmark" size={18} color="#fff" />
                        ) : null}
                      </View>
                      <Text className="text-[10px] text-muted text-center mt-1 capitalize">{key}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Color theme */}
              <View className="rounded-xl border border-border bg-background px-3 py-3">
                <View className="flex-row items-center">
                  <IconSymbol name="paintbrush.fill" size={18} color={colors.primary} />
                  <View className="flex-1 ml-2">
                    <Text className="text-sm font-semibold text-foreground">Color Theme</Text>
                    <Text className="text-[11px] text-muted mt-0.5">Base look of the app</Text>
                  </View>
                </View>
                <View className="flex-row gap-3 mt-3">
                  {(Object.keys(COLOR_THEMES) as ColorThemeKey[]).map((key) => (
                    <Pressable
                      key={key}
                      onPress={() => {
                        haptic();
                        setColorThemeLocal(key);
                      }}
                      style={({ pressed }) => [pressed && { transform: [{ scale: 0.95 }], opacity: 0.85 }]}
                    >
                      <View
                        className="items-center justify-center rounded-full"
                        style={{
                          width: 40,
                          height: 40,
                          backgroundColor: COLOR_THEMES[key].sample,
                          borderWidth: colorTheme === key ? 3 : 0,
                          borderColor: colors.foreground,
                        }}
                      >
                        {colorTheme === key ? (
                          <IconSymbol name="checkmark" size={18} color="#fff" />
                        ) : null}
                      </View>
                      <Text className="text-[10px] text-muted text-center mt-1 capitalize">{key}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Font size */}
              <View className="rounded-xl border border-border bg-background px-3 py-3">
                <View className="flex-row items-center">
                  <IconSymbol name="textformat" size={18} color={colors.primary} />
                  <View className="flex-1 ml-2">
                    <Text className="text-sm font-semibold text-foreground">Font Size</Text>
                    <Text className="text-[11px] text-muted mt-0.5">Message text size in chats</Text>
                  </View>
                </View>
                <View className="flex-row gap-3 mt-3">
                  {(Object.keys(FONT_SIZES) as Array<"small" | "medium" | "large">).map((key) => (
                    <Pressable
                      key={key}
                      onPress={() => {
                        haptic();
                        setFontSizeChoice(key);
                      }}
                      style={({ pressed }) => [pressed && { transform: [{ scale: 0.95 }], opacity: 0.85 }]}
                    >
                      <View
                        className="items-center justify-center rounded-full"
                        style={{
                          width: 40,
                          height: 40,
                          backgroundColor: fontSizeChoice === key ? colors.primary : colors.border,
                          borderWidth: fontSizeChoice === key ? 3 : 0,
                          borderColor: colors.foreground,
                        }}
                      >
                        {fontSizeChoice === key ? (
                          <IconSymbol name="checkmark" size={18} color="#fff" />
                        ) : (
                          <Text className="text-sm font-semibold" style={{ color: colors.muted }}>{key === "small" ? "S" : key === "medium" ? "M" : "L"}</Text>
                        )}
                      </View>
                      <Text className="text-[10px] text-muted text-center mt-1 capitalize">{key}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Usage stats */}
              {usageStats && (
                <View className="rounded-xl border border-border bg-background px-3 py-3">
                  <View className="flex-row items-center">
                    <IconSymbol name="chart.bar" size={18} color={colors.primary} />
                    <View className="flex-1 ml-2">
                      <Text className="text-sm font-semibold text-foreground">Usage</Text>
                      <Text className="text-[11px] text-muted mt-0.5">
                        AI reply chars since last reset
                      </Text>
                    </View>
                    <Pressable
                      onPress={async () => {
                        haptic();
                        await resetUsageStats();
                        loadUsageStats();
                      }}
                      style={({ pressed }) => [pressed && { opacity: 0.6 }]}
                    >
                      <Text className="text-[11px] font-semibold" style={{ color: colors.primary }}>Reset</Text>
                    </Pressable>
                  </View>
                  <View className="mt-3 gap-2">
                    {(() => {
                      const rows = (Object.entries(usageStats) as [string, { messages: number; chars: number; lastUsed: number }][])
                        .sort((a, b) => b[1].chars - a[1].chars)
                        .slice(0, 6);
                      const maxChars = rows.length > 0 ? rows[0][1].chars : 0;
                      return rows.map(([model, s]) => (
                        <View key={model} className="flex-row items-center gap-2">
                          <Text className="text-[11px] text-muted" style={{ width: 110 }} numberOfLines={1}>{model}</Text>
                          <View style={{ flex: 1, height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: "hidden" }}>
                            <View style={{ height: 8, width: `${Math.min(100, maxChars > 0 ? (s.chars / maxChars) * 100 : 0)}%`, backgroundColor: colors.primary, borderRadius: 4 }} />
                          </View>
                          <Text className="text-[11px] text-muted" style={{ width: 72, textAlign: "right" }}>{s.chars.toLocaleString()} chars</Text>
                        </View>
                      ));
                    })()}
                  </View>
                </View>
              )}
              <View className="rounded-xl border border-border bg-background px-3 py-3 flex-row items-center justify-between">
                <View className="flex-row items-center flex-1 pr-2">
                  <IconSymbol
                    name={cloudSyncOn ? "cloud.fill" : "cloud.slash.fill"}
                    size={18}
                    color={cloudSyncOn ? colors.success : colors.muted}
                  />
                  <View className="flex-1 ml-2">
                    <Text className="text-sm font-semibold text-foreground">Cloud Sync</Text>
                    <Text className="text-[11px] text-muted mt-0.5">
                      {cloudSyncOn
                        ? "On — chats sync across your devices (still auto-delete after 3 days)"
                        : "Off — chats stay on this phone only"}
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={async () => {
                    haptic();
                    const next = !cloudSyncOn;
                    await setCloudSyncEnabled(next);
                    setCloudSyncOn(next);
                    if (next) requestSync();
                    if (Platform.OS !== "web") {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }
                  }}
                  style={({ pressed }) => [
                    styles.testBtn,
                    {
                      backgroundColor: cloudSyncOn ? colors.success + "22" : colors.border,
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text
                    className="text-xs font-semibold"
                    style={{ color: cloudSyncOn ? colors.success : colors.muted }}
                  >
                    {cloudSyncOn ? "On" : "Off"}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* In-app update check */}
            <View className="mt-4 rounded-xl border border-border bg-background px-3 py-2.5">
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-2">
                  <Text className="text-sm font-semibold text-foreground">App Updates</Text>
                  <Text className="text-[11px] text-muted mt-0.5">
                    {currentVersion
                      ? `Config version ${currentVersion} — fixes arrive without reinstalling.`
                      : "Model & endpoint fixes arrive without reinstalling."}
                  </Text>
                </View>
                <Pressable
                  onPress={async () => {
                    haptic();
                    setUpdateState({ loading: true, status: "checking", message: "Checking for updates…" });
                    const result = await checkForUpdates();
                    if (result.applied) {
                      setCurrentVersion(result.version);
                      setUpdateState({
                        loading: false,
                        status: "success",
                        message: `Update applied — config ${result.version ?? ""}`.trim(),
                      });
                      if (Platform.OS !== "web") {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      }
                    } else if (result.version && !result.error) {
                      setUpdateState({ loading: false, status: "uptodate", message: "Already up to date" });
                    } else {
                      setUpdateState({
                        loading: false,
                        status: "error",
                        message: result.error ?? "Update check failed",
                      });
                    }
                  }}
                  disabled={updateState.loading}
                  style={({ pressed }) => [
                    styles.testBtn,
                    {
                      backgroundColor:
                        updateState.status === "error" ? colors.error + "22" : colors.primary + "22",
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  {updateState.loading ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text className="text-xs font-semibold" style={{ color: colors.primary }}>
                      {updateState.status === "error" ? "Retry" : "Check"}
                    </Text>
                  )}
                </Pressable>
              </View>
              {updateState.status === "checking" && (
                <View className="flex-row items-center gap-2 mt-2">
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text className="text-[11px] text-muted">Checking for updates…</Text>
                </View>
              )}
              {updateState.status === "success" && updateState.message && (
                <View className="flex-row items-center gap-1.5 mt-2">
                  <IconSymbol name="checkmark.circle.fill" size={13} color={colors.success} />
                  <Text className="text-[11px] text-success">{updateState.message}</Text>
                </View>
              )}
              {updateState.status === "uptodate" && updateState.message && (
                <View className="flex-row items-center gap-1.5 mt-2">
                  <IconSymbol name="checkmark.circle.fill" size={13} color={colors.muted} />
                  <Text className="text-[11px] text-muted">{updateState.message}</Text>
                </View>
              )}
              {updateState.status === "error" && updateState.message && (
                <View className="flex-row items-center gap-1.5 mt-2">
                  <IconSymbol name="exclamationmark.triangle.fill" size={13} color={colors.error} />
                  <Text className="text-[11px] text-error">{updateState.message}</Text>
                </View>
              )}
            </View>

            {/* Saved prompts */}
            <View className="mt-5 rounded-xl border border-border bg-background px-3 py-3">
              <View className="flex-row items-center">
                <IconSymbol name="sparkles" size={18} color={colors.primary} />
                <View className="flex-1 ml-2">
                  <Text className="text-sm font-semibold text-foreground">Saved Prompts</Text>
                  <Text className="text-[11px] text-muted mt-0.5">Quick-send shortcuts; tap any chip in chat to send it</Text>
                </View>
              </View>
              {prompts.length > 0 && (
                <View className="flex-row flex-wrap mt-3">
                  {prompts.map((p) => (
                    <Pressable
                      key={p.id}
                      onPress={async () => {
                        haptic();
                        await (async () => {
                          const { deletePrompt } = await import("@/lib/storage");
                          await deletePrompt(p.id);
                        })();
                        const { getSavedPrompts } = await import("@/lib/storage");
                        setPrompts(await getSavedPrompts());
                      }}
                      style={({ pressed }) => [
                        styles.promptChip,
                        { borderColor: colors.border, backgroundColor: colors.background },
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <Text className="text-[11px] text-foreground mr-1" numberOfLines={1}>{p.name || p.text.slice(0, 24)}</Text>
                      <IconSymbol name="trash.fill" size={12} color={colors.error} />
                    </Pressable>
                  ))}
                </View>
              )}
              <TextInput
                value={promptName}
                onChangeText={setPromptName}
                placeholder="Prompt name (e.g. Translate)"
                placeholderTextColor={colors.muted}
                returnKeyType="done"
                className="rounded-xl text-sm text-foreground"
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                  minHeight: 40,
                  color: colors.foreground,
                  marginTop: 10,
                }}
              />
              <TextInput
                value={promptTextState}
                onChangeText={setPromptTextState}
                placeholder="Prompt text (what gets sent to the AI)"
                placeholderTextColor={colors.muted}
                multiline
                maxLength={400}
                returnKeyType="done"
                className="rounded-xl text-sm text-foreground"
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                  minHeight: 48,
                  color: colors.foreground,
                  textAlignVertical: "top",
                  marginTop: 8,
                }}
              />
              <Pressable
                onPress={async () => {
                  haptic();
                  const text = promptTextState.trim();
                  if (!text) return;
                      await (async () => {
                    const { savePrompt } = await import("@/lib/storage");
                    await savePrompt(promptName.trim(), promptTextState.trim());
                  })();
                  const { getSavedPrompts } = await import("@/lib/storage");
                  setPrompts(await getSavedPrompts());
                  setPromptName("");
                  setPromptTextState("");
                }}
                style={({ pressed }) => [
                  styles.backupBtn,
                  { backgroundColor: promptTextState.trim() ? colors.primary + "22" : colors.border, marginTop: 10 },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text className="text-xs font-semibold" style={{ color: promptTextState.trim() ? colors.primary : colors.muted }}>
                  Add Prompt
                </Text>
              </Pressable>
            </View>

            {/* TTS voice & speed */}
            <View className="mt-5 rounded-xl border border-border bg-background px-3 py-3">
              <View className="flex-row items-center">
                <IconSymbol name="speaker.wave.2.fill" size={18} color={colors.primary} />
                <View className="flex-1 ml-2">
                  <Text className="text-sm font-semibold text-foreground">Read Aloud (TTS)</Text>
                  <Text className="text-[11px] text-muted mt-0.5">Voice & speed for the speaker button</Text>
                </View>
              </View>
              <View className="flex-row items-center mt-3" style={{ gap: 8 }}>
                <Pressable
                  onPress={async () => {
                    haptic();
                    const next = Math.max(0.5, +(ttsRate - 0.2).toFixed(1));
                    setTtsRate(next);
                    await (async () => {
                      const { getTtsPrefs, setTtsPrefs } = await import("@/lib/storage");
                      const prefs = await getTtsPrefs();
                      await setTtsPrefs({ ...prefs, rate: next });
                    })();
                  }}
                  style={({ pressed }) => [styles.ttsBtn, { backgroundColor: colors.background, borderColor: colors.border }, pressed && { opacity: 0.7 }]}
                >
                  <Text className="text-sm font-semibold text-foreground">−</Text>
                </Pressable>
                <Text className="text-sm font-semibold text-foreground">{Math.round(ttsRate * 100)}%</Text>
                <Pressable
                  onPress={async () => {
                    haptic();
                    const next = Math.min(2, +(ttsRate + 0.2).toFixed(1));
                    setTtsRate(next);
                    await (async () => {
                      const { getTtsPrefs, setTtsPrefs } = await import("@/lib/storage");
                      const prefs = await getTtsPrefs();
                      await setTtsPrefs({ ...prefs, rate: next });
                    })();
                  }}
                  style={({ pressed }) => [styles.ttsBtn, { backgroundColor: colors.background, borderColor: colors.border }, pressed && { opacity: 0.7 }]}
                >
                  <Text className="text-sm font-semibold text-foreground">+</Text>
                </Pressable>
                <Pressable
                  onPress={async () => {
                    haptic();
                    setTtsRate(1);
                    await (async () => {
                      const { getTtsPrefs, setTtsPrefs } = await import("@/lib/storage");
                      const prefs = await getTtsPrefs();
                      await setTtsPrefs({ ...prefs, rate: 1 });
                    })();
                  }}
                  style={({ pressed }) => [styles.ttsBtn, { backgroundColor: colors.background, borderColor: colors.border }, pressed && { opacity: 0.7 }]}
                >
                  <Text className="text-[11px] text-muted">100%</Text>
                </Pressable>
              </View>
                <Text className="text-[11px] text-muted mt-3">
                  Voice & language follow your phone's speech settings. Use {"−"} / {"+"} to adjust speed (50% – 200%).
                </Text>
                <Pressable
                  onPress={async () => {
                    haptic();
                    const next = !appLockOn;
                    setAppLockOn(next);
                    const { setAppLockEnabled } = await import("@/lib/storage");
                    await setAppLockEnabled(next);
                    if (Platform.OS !== "web") {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }
                  }}
                  style={({ pressed }) => [
                    styles.toggleRow,
                    { borderColor: colors.border },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <View className="flex-1 pr-2">
                    <Text className="text-sm font-semibold text-foreground">App Lock</Text>
                    <Text className="text-[11px] text-muted mt-0.5">
                      Require fingerprint or PIN every time the app opens. First time: set a 4–6 digit PIN, then biometric unlock is used if your phone has it.
                    </Text>
                  </View>
                  <View style={[styles.toggleTrack, { backgroundColor: appLockOn ? colors.primary : colors.border }]}>
                    <View
                      style={[
                        styles.toggleThumb,
                        { transform: [{ translateX: appLockOn ? 18 : 0 }], backgroundColor: "#fff" },
                      ]}
                    />
                  </View>
                </Pressable>
                <Pressable
                  onPress={async () => {
                    haptic();
                    const next = !autoReadAloud;
                    setAutoReadAloud(next);
                    const { setAutoReadAloud: save } = await import("@/lib/storage");
                    await save(next);
                  }}
                  style={({ pressed }) => [
                    styles.toggleRow,
                    { borderColor: colors.border },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <View className="flex-1 pr-2">
                    <Text className="text-sm font-semibold text-foreground">Voice Reply (auto read-aloud)</Text>
                    <Text className="text-[11px] text-muted mt-0.5">AI answers are read aloud automatically when they finish. The speaker button still works as manual override.</Text>
                  </View>
                  <View style={[styles.toggleTrack, { backgroundColor: autoReadAloud ? colors.primary : colors.border }]}>
                    <View
                      style={[
                        styles.toggleThumb,
                        { transform: [{ translateX: autoReadAloud ? 18 : 0 }] },
                      ]}
                    />
                  </View>
                </Pressable>
            </View>

            {/* Model */}
            <View className="mt-5">
              <Text className="text-sm font-semibold text-foreground mb-1.5">Model</Text>
              <TextInput
                value={modelText}
                onChangeText={setModelText}
                placeholder="provider/model-id (e.g. mistral/mistral-small-latest)"
                placeholderTextColor={colors.muted}
                returnKeyType="done"
                className="rounded-xl text-sm text-foreground"
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  minHeight: 44,
                  color: colors.foreground,
                }}
              />
              <Text className="text-[11px] text-muted mt-1">
                Easier: use the model picker chip in the chat header.
              </Text>
            </View>

            {/* Custom system prompt */}
            <View className="mt-5">
              <Text className="text-sm font-semibold text-foreground mb-1.5">Custom Instructions</Text>
              <TextInput
                value={systemPromptText}
                onChangeText={setSystemPromptText}
                placeholder="Optional — e.g. “Reply in Hindi”, “Always keep answers short”"
                placeholderTextColor={colors.muted}
                multiline
                maxLength={500}
                returnKeyType="done"
                blurOnSubmit
                className="rounded-xl text-sm text-foreground"
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  minHeight: 64,
                  color: colors.foreground,
                  textAlignVertical: "top",
                }}
              />
              <Text className="text-[11px] text-muted mt-1">
                Overrides the AI's default behavior for every chat. Applied from the next message you send.
              </Text>
              <View className="flex-row flex-wrap mt-2">
                {["Reply in Hindi", "Keep answers short", "Formal tone", "Explain like I'm 5"].map((preset) => {
                  const active = systemPromptText.toLowerCase() === preset.toLowerCase();
                  return (
                    <Pressable
                      key={preset}
                      onPress={() => setSystemPromptText(active ? "" : preset)}
                      style={({ pressed }) => [
                        styles.preset,
                        { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary + "18" : colors.background },
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <Text className="text-[11px]" style={{ color: active ? colors.primary : colors.muted }}>{preset}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Model Presets */}
            <View className="mt-6">
              <Text className="text-sm font-semibold text-foreground mb-2">Model Presets</Text>
              <Text className="text-[11px] text-muted mb-2">
                Save the current chat's model and mode for quick reuse. New chats start with your last-used model anyway.
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {presets.map((p) => {
                  const modeLabel = p.chatMode && p.chatMode !== "normal" ? ` · ${MODE_LABELS[p.chatMode as keyof typeof MODE_LABELS] ?? p.chatMode}` : "";
                  return (
                    <View key={p.id} className="flex-row items-center">
                      <Pressable
                        onPress={() => {
                          haptic();
                          setModelText(p.modelKey);
                          setPresetSaveMsg(`"${p.name}" model loaded`);
                          setTimeout(() => setPresetSaveMsg(null), 2000);
                        }}
                        style={({ pressed }) => [
                          styles.preset,
                          { borderColor: colors.primary, backgroundColor: colors.primary + "18" },
                          pressed && { opacity: 0.7 },
                        ]}
                      >
                        <Text className="text-[11px]" style={{ color: colors.primary }}>
                          {p.name}{modeLabel}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={async () => {
                          haptic();
                          const { deleteModelPreset, getModelPresets } = await import("@/lib/storage");
                          await deleteModelPreset(p.id);
                          setPresets(await getModelPresets());
                        }}
                        hitSlop={8}
                        style={({ pressed }) => [{ marginLeft: 6 }, pressed && { opacity: 0.6 }]}
                      >
                        <IconSymbol name="trash.fill" size={13} color={colors.error} />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
              <View className="flex-row items-center mt-2 gap-2">
                <TextInput
                  className="text-foreground"
                  placeholder="Preset name (e.g. Deep Research)"
                  placeholderTextColor={colors.muted}
                  value={promptName || ""}
                  onChangeText={setPromptName}
                  returnKeyType="done"
                  style={[{ flex: 1, borderWidth: 0.5, borderColor: colors.border, backgroundColor: colors.background, color: colors.foreground, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, minHeight: 38 }]}
                />
                <Pressable
                  onPress={async () => {
                    haptic();
                    const name = promptName.trim();
                    if (!name) return;
                    const { saveModelPreset, getModelPresets } = await import("@/lib/storage");
                    await saveModelPreset({ name, modelKey: modelText });
                    setPromptName("");
                    setPresets(await getModelPresets());
                    setPresetSaveMsg(`Preset "${name}" saved`);
                    setTimeout(() => setPresetSaveMsg(null), 2000);
                  }}
                  style={({ pressed }) => [
                    styles.saveBtn,
                    { backgroundColor: colors.primary },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text className="text-xs font-bold text-white">Save Current</Text>
                </Pressable>
              </View>
              {presetSaveMsg ? <Text className="text-[11px] text-success mt-1">{presetSaveMsg}</Text> : null}
            </View>

            {/* Web Search */}
            <View className="mt-6">
              <Text className="text-sm font-semibold text-foreground mb-2">Web Search</Text>
              <View className="flex-row items-center justify-between bg-surface rounded-xl px-4 py-3">
                <View className="flex-1 mr-3">
                  <Text className="text-sm text-foreground">Web search mode</Text>
                  <Text className="text-[11px] text-muted mt-0.5">
                    Tell the AI to use live web search for current information (works best with models that have search tools enabled on your provider account)
                  </Text>
                </View>
                <Switch
                  value={webSearchOn}
                  onValueChange={(v) => {
                    haptic();
                    setWebSearchOn(v);
                    (async () => {
                      const { setWebSearchEnabled } = await import("@/lib/storage");
                      await setWebSearchEnabled(v);
                    })();
                  }}
                  trackColor={{ true: colors.primary }}
                />
              </View>
            </View>

            {/* Knowledge Base */}
            <View className="mt-6">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-sm font-semibold text-foreground">Knowledge Base</Text>
                <Pressable
                  onPress={async () => {
                    haptic();
                    try {
                      const res = await DocumentPicker.getDocumentAsync({ type: "text/*", copyToCacheDirectory: true });
                      if (res.canceled || !res.assets?.[0]) return;
                      const file = res.assets[0];
                      const text = await FileSystem.readAsStringAsync(file.uri, { encoding: "utf8" });
                      const { saveKbDoc, getKbDocs } = await import("@/lib/storage");
                      await saveKbDoc({ name: file.name, text: text.slice(0, 60000), active: true });
                      setKbDocs(await getKbDocs());
                      setKbMsg(`Added "${file.name}"`);
                      setTimeout(() => setKbMsg(null), 2500);
                    } catch {
                      setKbMsg("Could not read file — try a .txt file");
                      setTimeout(() => setKbMsg(null), 2500);
                    }
                  }}
                  style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                >
                  <IconSymbol name="plus" size={18} color={colors.primary} />
                </Pressable>
              </View>
              <Text className="text-[11px] text-muted mb-2">
                Saved docs are used as context in every chat (resumes, notes, reference material). Tap the doc to toggle it on/off.
              </Text>
              {kbDocs.length === 0 && <Text className="text-[12px] text-muted">No documents yet — tap + to add a .txt file</Text>}
              <View className="gap-2">
                {kbDocs.map((d) => (
                  <View key={d.id} className="flex-row items-center bg-surface rounded-xl px-4 py-3">
                    <IconSymbol name={d.active ? "doc.fill" : "doc.text.fill"} size={15} color={d.active ? colors.primary : colors.muted} />
                    <View className="flex-1 ml-3">
                      <Text className="text-sm text-foreground" numberOfLines={1}>{d.name}</Text>
                      <Text className="text-[10px] text-muted">{d.active ? "Active — used in chat" : "Inactive"} · {d.text.length.toLocaleString()} chars</Text>
                    </View>
                    <Pressable
                      onPress={async () => {
                        haptic();
                      const { toggleKbDocActive, getKbDocs } = await import("@/lib/storage");
                      await toggleKbDocActive(d.id);
                      setKbDocs(await getKbDocs());
                      }}
                      style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                    >
                      <IconSymbol name={d.active ? "visibility" : "visibility-off"} size={17} color={d.active ? colors.primary : colors.muted} />
                    </Pressable>
                    <Pressable
                      onPress={async () => {
                        haptic();
                      const { deleteKbDoc, getKbDocs } = await import("@/lib/storage");
                      await deleteKbDoc(d.id);
                      setKbDocs(await getKbDocs());
                      }}
                      hitSlop={8}
                      style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, marginLeft: 12 }]}
                    >
                      <IconSymbol name="delete" size={17} color={colors.error} />
                    </Pressable>
                  </View>
                ))}
              </View>
              {kbMsg ? <Text className="text-[11px] text-success mt-1">{kbMsg}</Text> : null}
            </View>

            {/* Resume Builder */}
            <View className="mt-6">
              <Text className="text-sm font-semibold text-foreground mb-2">Resume Builder</Text>
              <Pressable
                onPress={() => {
                  haptic();
                  setResumeOpen(true);
                }}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: colors.surface,
                  borderWidth: 0.5,
                  borderColor: colors.border,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <IconSymbol name="note-add" size={17} color={colors.primary} />
                <Text className="text-sm text-foreground ml-3 flex-1">Build a professional resume</Text>
                <IconSymbol name="chevron.right" size={16} color={colors.muted} />
              </Pressable>
              <Text className="text-[11px] text-muted mt-2">
                Tell the AI your details (name, education, experience, skills) and get a proper formatted resume PDF.
              </Text>
            </View>

            {/* API Keys */}
            <View className="mt-6">
              <Text className="text-sm font-semibold text-foreground mb-2">API Keys</Text>
              <View className="gap-3">
                {PROVIDERS.map((p) => {
                  const t = tests[p.key];
                  return (
                    <View key={p.key}>
                      <View className="flex-row items-center">
                        <Text className="text-sm font-medium text-foreground flex-1">{p.inputLabel}</Text>
                        {t && !t.loading && (
                          <Text className={`text-[11px] mr-2 ${t.ok ? "text-success" : "text-error"}`}>
                            {t.message}
                          </Text>
                        )}
                        <Pressable
                          onPress={() => {
                            haptic();
                            handleTest(p.key);
                          }}
                          disabled={t?.loading}
                          style={({ pressed }) => [
                            styles.testBtn,
                            { backgroundColor: t?.loading ? colors.border : colors.primary + "22" },
                            pressed && { opacity: 0.7 },
                          ]}
                        >
                          {t?.loading ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                          ) : (
                            <Text className="text-xs font-semibold" style={{ color: colors.primary }}>
                              Test
                            </Text>
                          )}
                        </Pressable>
                      </View>
                      <TextInput
                        value={keys[p.key] ?? ""}
                        onChangeText={(v) => setKey(p.key, v)}
                        placeholder={p.placeholder}
                        placeholderTextColor={colors.muted}
                        secureTextEntry
                        returnKeyType="done"
                        autoCapitalize="none"
                        autoCorrect={false}
                        className="rounded-xl text-sm text-foreground"
                        style={{
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: colors.background,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          minHeight: 42,
                          color: colors.foreground,
                          marginTop: 6,
                        }}
                      />
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Backup: export / import chats */}
            <View className="mt-5 rounded-xl border border-border bg-background px-3 py-3">
              <View className="flex-row items-center">
                <IconSymbol name="arrow.down.doc.fill" size={18} color={colors.primary} />
                <View className="flex-1 ml-2">
                  <Text className="text-sm font-semibold text-foreground">Backup & Restore</Text>
                  <Text className="text-[11px] text-muted mt-0.5">Export chats to a JSON file, or restore from one</Text>
                </View>
              </View>
              <View className="flex-row gap-2 mt-3">
                <Pressable
                  onPress={async () => {
                    haptic();
                    setExportState({ loading: true });
                    try {
                      const json = await exportAllChats();
                      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
                      const localUri = `${FileSystem.cacheDirectory}asky-backup-${ts}.json`;
                      await FileSystem.writeAsStringAsync(localUri, json);
                      const canShare = await Sharing.isAvailableAsync();
                      if (canShare) {
                        await Sharing.shareAsync(localUri, {
                          mimeType: "application/json",
                          dialogTitle: "Share Asky backup",
                        });
                      } else {
                        // Web fallback: open file in browser to save
                        const contentUri = FileSystem.documentDirectory + `asky-backup-${ts}.json`;
                        await FileSystem.writeAsStringAsync(contentUri, json);
                        setExportState({ loading: false, ok: true, message: "Saved in Downloads — use your browser to save it" });
                        return;
                      }
                      setExportState({ loading: false, ok: true, message: "Shared! Save the .json file somewhere safe" });
                    } catch {
                      setExportState({ loading: false, ok: false, message: "Export failed" });
                    }
                  }}
                  disabled={exportState.loading}
                  style={({ pressed }) => [
                    styles.backupBtn,
                    { backgroundColor: colors.primary + "22" },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  {exportState.loading ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text className="text-xs font-semibold" style={{ color: colors.primary }}>
                      Export
                    </Text>
                  )}
                </Pressable>
                <Pressable
                  onPress={async () => {
                    haptic();
                    setImportState({ loading: true });
                    try {
                      const picked = await DocumentPicker.getDocumentAsync({
                        type: ["application/json", "*/*"],
                        copyToCacheDirectory: true,
                      });
                      if (picked.canceled || picked.assets.length === 0) {
                        setImportState({ loading: false });
                        return;
                      }
                      const json = await FileSystem.readAsStringAsync(picked.assets[0].uri);
                      const result = await importChats(json);
                      setImportState({
                        loading: false,
                        ok: true,
                        message:
                          result.importedChats === 0
                            ? "Nothing new — existing chats skipped"
                            : `Imported ${result.importedChats} chat${result.importedChats === 1 ? "" : "s"}${result.skippedChats > 0 ? ` (${result.skippedChats} skipped)` : ""}`,
                      });
                      onImported?.();
                      if (Platform.OS !== "web") {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      }
                    } catch (e) {
                      setImportState({
                        loading: false,
                        ok: false,
                        message: e instanceof Error ? e.message : "Import failed",
                      });
                    }
                  }}
                  disabled={importState.loading}
                  style={({ pressed }) => [
                    styles.backupBtn,
                    { backgroundColor: importState.ok ? colors.success + "22" : colors.background, borderWidth: 1, borderColor: colors.border },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  {importState.loading ? (
                    <ActivityIndicator size="small" color={colors.foreground} />
                  ) : (
                    <Text className="text-xs font-semibold text-foreground">Import</Text>
                  )}
                </Pressable>
              </View>
              {(exportState.message || importState.message) && (() => {
                const ok = exportState.ok ?? importState.ok;
                const iconName = ok ? "checkmark.circle.fill" : "exclamationmark.triangle.fill";
                const msg = exportState.message || importState.message;
                return (
                <View className="flex-row items-center gap-1.5 mt-2">
                  <IconSymbol
                    name={iconName}
                    size={13}
                    color={ok ? colors.success : colors.error}
                  />
                  <Text
                    className="text-[11px]"
                    style={{ color: ok ? colors.success : colors.error }}
                  >
                    {msg}
                  </Text>
                </View>
                );
              })()}
            </View>

            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={({ pressed }) => [
                styles.saveBtn,
                { backgroundColor: saving ? colors.border : colors.primary },
                pressed && !saving && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-white font-semibold text-base">Save</Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
      <ResumeSheet visible={resumeOpen} onClose={() => setResumeOpen(false)} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: 640,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 0.5,
  },
  preset: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 6,
  },
  testBtn: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  backupBtn: {
    flex: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    alignItems: "center",
  },
  saveBtn: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 16,
  },
  promptChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    maxWidth: 180,
    marginRight: 6,
    marginBottom: 6,
  },
  ttsBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  ttsVoiceChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingVertical: 4,
  },
  toggleTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    padding: 3,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#fff",
  },
});

import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { MessageText } from "@/components/message-text";
import { useColors } from "@/hooks/use-colors";
import { getModel, PROVIDERS, MODELS, type ModelDef } from "@/lib/providers";
import { streamChat } from "@/lib/ai";
import { getCustomSystemPrompt } from "@/lib/storage";
import { resolveApiKey } from "@/lib/builtin-keys";
import { setBusyModel } from "@/lib/busy-model";

interface CompareResult {
  modelKey: string;
  text: string;
  error?: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Optional initial prompt (e.g. from composer). */
  initialPrompt?: string;
}

/**
 * Side-by-side model comparison: pick 2 models, send the same prompt,
 * watch both replies stream live.
 */
export function CompareSheet({ visible, onClose, initialPrompt }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<"pick" | "run">("pick");
  const [pickA, setPickA] = useState<string | null>(null);
  const [pickB, setPickB] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [results, setResults] = useState<CompareResult[]>([]);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const models = PROVIDERS.flatMap((p) => MODELS.filter((m) => m.providerKey === p.key && !m.vision));

  const pick = (key: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (pickA === null) setPickA(key);
    else if (pickB === null && key !== pickA) setPickB(key);
    else {
      // both picked: rotate — replace the older one
      setPickA(pickB);
      setPickB(key);
    }
  };

  const reset = useCallback(() => {
    setStep("pick");
    setPickA(null);
    setPickB(null);
    setPrompt("");
    setResults([]);
    setRunning(false);
  }, []);

  const runCompare = useCallback(async () => {
    if (!pickA || !pickB || !prompt.trim()) return;
    const keys = [pickA, pickB];
    setRunning(true);
    setResults(keys.map((k) => ({ modelKey: k, text: "" })));
    setStep("run");

    for (let i = 0; i < keys.length; i++) {
      // eslint-disable-next-line no-await-in-loop
      await runOne(keys[i], i);
    }
    setBusyModel(null);
    setRunning(false);
  }, [pickA, pickB, prompt]);

  const runOne = async (modelKey: string, index: number) => {
    const model = getModel(modelKey);
    if (!model) return;
    const apiKey = await resolveApiKey(model.providerKey);
    const systemPrompt = (async () => {
      try {
        const custom = await getCustomSystemPrompt();
        return custom?.trim() ? custom : "You are a helpful assistant.";
      } catch {
        return "You are a helpful assistant.";
      }
    })();
    if (!apiKey) {
      setResults((prev) =>
        prev.map((r, i) =>
          i === index ? { ...r, text: `Missing API key for ${PROVIDERS.find(p => p.key === model.providerKey)?.label}. Add it in Settings.`, error: true } : r,
        ),
      );
      return;
    }
    const text = prompt.trim();
    setBusyModel(modelKey);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await streamChat({
        signal: controller.signal,
        modelKey,
        messages: [
          { role: "system", text: await systemPrompt },
          { role: "user", text },
        ],
        onToken: (token: string) => {
          setResults((prev) =>
            prev.map((r, i) => (i === index ? { ...r, text: r.text + token } : r)),
          );
        },
      } as never);
        } catch (err) {
      setResults((prev) =>
        prev.map((r, i) =>
          i === index
            ? { ...r, text: `Error: ${err instanceof Error ? err.message : String(err)}`, error: true }
            : r,
        ),
      );
    } finally {
      abortRef.current = null;
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { reset(); onClose(); }}>
      <Pressable style={styles.backdrop} onPress={() => { reset(); onClose(); }} />
      <View style={[styles.sheet, { backgroundColor: colors.background }]}>
        <View style={styles.handleRow}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
        </View>
        <View style={styles.titleRow}>
          <Text className="text-foreground text-lg font-bold">Compare Models</Text>
          <Pressable onPress={() => { reset(); onClose(); }} hitSlop={8}>
            <IconSymbol name="xmark" size={20} color={colors.muted} />
          </Pressable>
        </View>

        {step === "pick" ? (
          <>
            <Text className="text-muted text-xs" style={styles.subtitle}>
              Pick 2 models and one prompt — both answer side by side.
            </Text>
            <View style={styles.picksRow}>
              <View style={[styles.pickChip, { borderColor: pickA ? colors.primary : colors.border }]}>
                <Text className="text-foreground text-xs" numberOfLines={1}>
                  {pickA ? getModel(pickA)?.name ?? pickA : "Model A"}
                </Text>
              </View>
              <Text className="text-muted text-xs">vs</Text>
              <View style={[styles.pickChip, { borderColor: pickB ? colors.primary : colors.border }]}>
                <Text className="text-foreground text-xs" numberOfLines={1}>
                  {pickB ? getModel(pickB)?.name ?? pickB : "Model B"}
                </Text>
              </View>
            </View>
            <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
              {models.map((m: ModelDef) => {
                const selected = m.id === pickA || m.id === pickB;
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => pick(m.id)}
                    style={({ pressed }) => [
                      styles.pickRow,
                      {
                        backgroundColor: selected ? colors.primary + "22" : colors.surface,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                      pressed && { transform: [{ scale: 0.98 }], opacity: 0.85 },
                    ]}
                  >
                    <Text className="text-foreground text-sm" style={{ flex: 1 }} numberOfLines={1}>
                      {m.name}
                    </Text>
                    <Text className="text-muted text-[10px]">{PROVIDERS.find(p => p.key === m.providerKey)?.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <TextInput
              value={prompt}
              onChangeText={setPrompt}
              placeholder="Ask one question..."
              placeholderTextColor={colors.muted}
              className="text-foreground text-sm"
              multiline
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                borderRadius: 12,
                marginHorizontal: 16,
                marginTop: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                minHeight: 64,
                color: colors.foreground,
                textAlignVertical: "top",
              }}
            />
            <Pressable
              onPress={runCompare}
              disabled={!pickA || !pickB || !prompt.trim()}
              style={({ pressed }) => [
                styles.runBtn,
                {
                  backgroundColor:
                    !pickA || !pickB || !prompt.trim() ? colors.border : colors.primary,
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={styles.runBtnText}>Start comparison</Text>
            </Pressable>
            <View style={{ paddingBottom: Math.max(insets.bottom, 12) }} />
          </>
        ) : (
          <View style={{ flex: 1 }}>
            <Text className="text-muted text-xs" style={styles.subtitle}>
              “{prompt.trim().slice(0, 80)}{prompt.trim().length > 80 ? "…" : ""}”
            </Text>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: Math.max(insets.bottom, 24) }}>
              {results.map((r) => {
                const model = getModel(r.modelKey);
                const isActive = running && !r.text && !r.error;
                return (
                  <View
                    key={r.modelKey}
                    style={[styles.compareCol, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    <View style={styles.colHeader}>
                      <Text className="text-foreground text-sm font-bold" numberOfLines={1}>
                        {model?.name ?? r.modelKey}
                      </Text>
                      {isActive && <ActivityIndicator size="small" color={colors.primary} />}
                    </View>
                    {r.text ? (
                      <MessageText text={r.text} muted={r.error} />
                    ) : (
                      <Text className="text-muted text-xs" style={{ padding: 8 }}>
                        Waiting…
                      </Text>
                    )}
                  </View>
                );
              })}
            </ScrollView>
            {!running && (
              <View style={styles.bottomRow}>
                <Pressable
                  onPress={() => { reset(); onClose(); }}
                  style={({ pressed }) => [styles.smallBtn, { backgroundColor: colors.border }, pressed && { opacity: 0.7 }]}
                >
                  <Text className="text-foreground text-sm font-semibold">Close</Text>
                </Pressable>
                <Pressable
                  onPress={async () => {
                    reset();
                    // reopen picks step within the same modal by toggling step
                    setPrompt("");
                    await Promise.resolve();
                    setStep("pick");
                  }}
                  style={({ pressed }) => [styles.smallBtn, { backgroundColor: colors.primary }, pressed && { opacity: 0.8 }]}
                >
                  <Text style={styles.smallBtnText}>New comparison</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: 620,
  },
  handleRow: {
    alignItems: "center",
    paddingTop: 10,
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 3,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  subtitle: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
  },
  picksRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  pickChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  pickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 6,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  runBtn: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  runBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  compareCol: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  colHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(128,128,128,0.25)",
    marginBottom: 8,
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    paddingBottom: 16,
  },
  smallBtn: {
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  smallBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
  },
});

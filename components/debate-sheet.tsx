import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { getModels } from "@/lib/remote-config";
import type { ModelDef } from "@/lib/providers";

function haptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

interface DebateSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Currently selected primary model key */
  currentModelKey: string;
  onApply: (model2Key: string, rounds: number) => void;
}

/** Sheets can't know which model is currently busy; caller should guard. */
export function DebateSheet({ visible, onClose, currentModelKey, onApply }: DebateSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [models, setModels] = useState<ModelDef[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [rounds, setRounds] = useState(2);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    getModels().then((m) => {
      const list = m.filter((d) => d.id !== currentModelKey);
      setModels(list);
      setSelected(list[0]?.id ?? "");
      setLoading(false);
    });
  }, [visible, currentModelKey]);

  const selectedModel = useMemo(() => models.find((m) => m.id === selected), [models, selected]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop} onStartShouldSetResponder={() => true}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={80} style={{ flex: 1, justifyContent: "flex-end" }}>
          <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border, paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
              <Text className="text-base font-bold text-foreground">Debate Mode</Text>
              <Pressable onPress={onClose} hitSlop={8} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
                <IconSymbol name="xmark" size={20} color={colors.muted} />
              </Pressable>
            </View>
            <Text className="text-[11px] text-muted px-5 pb-2 leading-relaxed">
              Two AI models argue with each other about your question — you get both sides.
            </Text>
            <ScrollView style={{ maxHeight: 280 }} className="px-5">
              {loading ? (
                <ActivityIndicator size="small" color={colors.primary} className="py-6" />
              ) : (
                <View className="gap-2 pb-3">
                  {models.map((m) => {
                    const active = selected === m.id;
                    return (
                      <Pressable
                        key={m.id}
                        onPress={() => {
                          haptic();
                          setSelected(m.id);
                        }}
                        style={({ pressed }) => ({
                          flexDirection: "row",
                          alignItems: "center",
                          paddingVertical: 11,
                          paddingHorizontal: 12,
                          borderRadius: 12,
                          borderWidth: 0.5,
                          borderColor: active ? colors.primary : colors.border,
                          backgroundColor: active ? colors.surface : colors.background,
                          opacity: pressed ? 0.7 : 1,
                        })}
                      >
                        <Text className="text-sm text-foreground flex-1">{m.name}</Text>
                        {active ? <IconSymbol name="checkmark" size={16} color={colors.primary} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </ScrollView>
            <View className="px-5 pb-2">
              <Text className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">Rounds</Text>
              <View className="flex-row gap-2">
                {[2, 3, 4].map((r) => {
                  const active = rounds === r;
                  return (
                    <Pressable
                      key={r}
                      onPress={() => {
                        haptic();
                        setRounds(r);
                      }}
                      style={({ pressed }) => ({
                        flex: 1,
                        alignItems: "center",
                        paddingVertical: 10,
                        borderRadius: 12,
                        borderWidth: 0.5,
                        borderColor: active ? colors.primary : colors.border,
                        backgroundColor: active ? colors.surface : colors.background,
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <Text className={`text-sm font-semibold ${active ? "text-primary" : "text-foreground"}`}>{r}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View className="px-5 pt-1">
              <Pressable
                disabled={!selectedModel}
                onPress={() => {
                  haptic();
                  if (selectedModel) onApply(selectedModel.id, rounds);
                  onClose();
                }}
                style={({ pressed }) => ({
                  alignItems: "center",
                  paddingVertical: 12,
                  borderRadius: 14,
                  backgroundColor: selectedModel ? colors.primary : colors.border,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text className="text-sm font-semibold text-background">Start Debate</Text>
              </Pressable>
              {selectedModel ? (
                <Text className="text-[10px] text-muted text-center mt-2">
                  {selectedModel.name} will debate against your current model ({rounds} round{rounds > 1 ? "s" : ""})
                </Text>
              ) : null}
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 0.5,
    maxHeight: "80%",
  },
});

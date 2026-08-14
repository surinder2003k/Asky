import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";

import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  MODE_DESCRIPTIONS,
  MODE_LABELS,
  TRANSLATE_TARGETS,
  type ChatMode,
} from "@/lib/modes";

interface ModesSheetProps {
  visible: boolean;
  onClose: () => void;
  currentMode: ChatMode;
  targetLanguage?: string;
  onApply: (mode: ChatMode, targetLanguage?: string) => void;
}

export function ModesSheet({
  visible,
  onClose,
  currentMode,
  targetLanguage,
  onApply,
}: ModesSheetProps) {
  const modes: ChatMode[] = ["normal", "deep_research", "thinking", "translator", "math", "screenshot_to_code"];
  const haptic = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, justifyContent: "flex-end" }}
        behavior={Platform.OS === "android" ? "height" : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text className="text-base font-bold text-foreground">Chat modes</Text>
            <Pressable onPress={onClose} hitSlop={8} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
              <IconSymbol name="xmark" size={18} color="#9a9a9a" />
            </Pressable>
          </View>
          <FlatList
            data={modes}
            keyExtractor={(m) => m}
            style={{ maxHeight: 300 }}
            contentContainerStyle={{ paddingVertical: 6 }}
            renderItem={({ item }) => {
              const active = currentMode === item;
              return (
                <Pressable
                  onPress={() => {
                    haptic();
                    if (item === "normal") {
                      onApply("normal", undefined);
                      onClose();
                    } else {
                      onApply(item, undefined);
                    }
                  }}
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
                >
                  <View style={[styles.rowLeft, active && { borderColor: "#10a37f" }]}>
                    <Text className="text-sm font-semibold text-foreground" style={{ flex: 1 }}>
                      {MODE_LABELS[item]}
                      {item === "translator" && targetLanguage ? ` → ${targetLanguage}` : ""}
                    </Text>
                    <Text className="text-[11px] text-muted" style={{ flex: 2, lineHeight: 16 }}>
                      {MODE_DESCRIPTIONS[item]}
                    </Text>
                  </View>
                  {active && (
                    <IconSymbol name="checkmark.circle.fill" size={20} color="#10a37f" style={{ marginLeft: 6 }} />
                  )}
                </Pressable>
              );
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function TranslatorSheet({
  visible,
  onClose,
  currentMode,
  targetLanguage,
  onApply,
}: Omit<ModesSheetProps, "currentMode" | "onApply"> & {
  currentMode: ChatMode;
  onApply: (mode: ChatMode, targetLanguage?: string) => void;
}) {
  const haptic = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  const [custom, setCustom] = useState("");

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, justifyContent: "flex-end" }}
        behavior={Platform.OS === "android" ? "height" : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text className="text-base font-bold text-foreground">Translate into</Text>
            <Pressable onPress={onClose} hitSlop={8} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
              <IconSymbol name="xmark" size={18} color="#9a9a9a" />
            </Pressable>
          </View>
          <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ paddingVertical: 6 }}>
            {TRANSLATE_TARGETS.map((lang) => {
              const active = currentMode === "translator" && targetLanguage === lang;
              return (
                <Pressable
                  key={lang}
                  onPress={() => {
                    haptic();
                    onApply("translator", lang);
                    onClose();
                  }}
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
                >
                  <Text className="text-sm text-foreground" style={{ flex: 1 }}>{lang}</Text>
                  {active && <IconSymbol name="checkmark.circle.fill" size={20} color="#10a37f" />}
                </Pressable>
              );
            })}
            <View style={{ paddingHorizontal: 12, paddingTop: 6 }}>
              <View style={styles.customRow}>
                <TextInput
                  value={custom}
                  onChangeText={setCustom}
                  placeholder="Other language / dialect"
                  placeholderTextColor="#9a9a9a"
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    if (custom.trim()) {
                      haptic();
                      onApply("translator", custom.trim());
                      setCustom("");
                      onClose();
                    }
                  }}
                  className="flex-1 text-foreground text-sm"
                  style={{ color: "#ececec", paddingVertical: 6 }}
                />
                <Pressable
                  onPress={() => {
                    if (custom.trim()) {
                      haptic();
                      onApply("translator", custom.trim());
                      setCustom("");
                      onClose();
                    }
                  }}
                  style={({ pressed }) => [pressed && { opacity: 0.6 }]}
                >
                  <IconSymbol name="chevron.right" size={24} color="#10a37f" />
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

import { useState } from "react";

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    backgroundColor: "#2f2f2f",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingBottom: 24,
    maxHeight: "80%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginVertical: 2,
  },
  rowLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  customRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#212121",
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#424242",
  },
});

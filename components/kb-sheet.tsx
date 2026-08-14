import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import {
  deleteKbDoc,
  getKbDocs,
  saveKbDoc,
  toggleKbDocActive,
  type KbDoc,
} from "@/lib/storage";

function haptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

interface KbSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function KbSheet({ visible, onClose }: KbSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [docs, setDocs] = useState<KbDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = () => getKbDocs().then(setDocs);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    refresh().then(() => setLoading(false));
  }, [visible]);

  const importFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ["text/plain", "application/pdf"], copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) return;
      const file = res.assets[0];
      let text = "";
      if (file.name.toLowerCase().endsWith(".pdf")) {
        try {
          const { extractPdfText } = await import("@/lib/ai");
          text = await extractPdfText({ uri: file.uri });
        } catch {
          setMsg("Could not read PDF — use plain text files");
          setTimeout(() => setMsg(null), 2500);
          return;
        }
      } else {
        text = await FileSystem.readAsStringAsync(file.uri, { encoding: "utf8" });
      }
      await saveKbDoc({ name: file.name, text: text.slice(0, 60000), active: true });
      setMsg(`Added "${file.name}"`);
      await refresh();
      setTimeout(() => setMsg(null), 2500);
    } catch {
      setMsg("Could not read file");
      setTimeout(() => setMsg(null), 2500);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop} onStartShouldSetResponder={() => true}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={80} style={{ flex: 1, justifyContent: "flex-end" }}>
          <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border, paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
              <Text className="text-base font-bold text-foreground">Knowledge Base</Text>
              <Pressable onPress={onClose} hitSlop={8} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
                <IconSymbol name="xmark" size={20} color={colors.muted} />
              </Pressable>
            </View>
            <Text className="text-[11px] text-muted px-5 pb-2 leading-relaxed">
              Text in your knowledge base is automatically added as context to every chat, so the AI knows about your notes and files.
            </Text>
            <ScrollView style={{ maxHeight: 260 }} className="px-5">
              {loading ? (
                <ActivityIndicator size="small" color={colors.primary} className="py-6" />
              ) : docs.length === 0 ? (
                <Text className="text-[12px] text-muted text-center py-6">No documents yet</Text>
              ) : (
                <View className="gap-2 pb-3">
                  {docs.map((d) => (
                    <View
                      key={d.id}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingVertical: 10,
                        paddingHorizontal: 10,
                        borderRadius: 12,
                        borderWidth: 0.5,
                        borderColor: colors.border,
                        backgroundColor: colors.surface,
                      }}
                    >
                      <IconSymbol name="doc.fill" size={16} color={d.active ? colors.primary : colors.muted} />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text className="text-[12px] font-medium text-foreground" numberOfLines={1}>{d.name}</Text>
                        <Text className="text-[10px] text-muted">{Math.round(d.text.length / 1000)}k characters</Text>
                      </View>
                      <Switch
                        value={d.active}
                        onValueChange={async () => {
                          haptic();
                          await toggleKbDocActive(d.id);
                          await refresh();
                        }}
                        trackColor={{ true: colors.primary, false: colors.border }}
                        thumbColor={colors.background}
                      />
                      <Pressable
                        onPress={async () => {
                          haptic();
                          await deleteKbDoc(d.id);
                          await refresh();
                        }}
                        hitSlop={8}
                        style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, marginLeft: 8 }]}
                      >
                        <IconSymbol name="delete" size={16} color={colors.muted} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
            {msg ? <Text className={`text-[11px] text-center mx-5 mb-1 ${msg.includes("Added") ? "text-success" : "text-error"}`}>{msg}</Text> : null}
            <View className="px-5 pt-1">
              <Pressable
                onPress={async () => {
                  haptic();
                  await importFile();
                }}
                style={({ pressed }) => ({
                  alignItems: "center",
                  paddingVertical: 12,
                  borderRadius: 14,
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text className="text-sm font-semibold text-background">Add document (txt/pdf)</Text>
              </Pressable>
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
    maxHeight: "75%",
  },
});

import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { cn } from "@/lib/utils";

interface CanvasScreenProps {
  visible: boolean;
  onClose: () => void;
  /** Initial code/text content (typically a code block or HTML) */
  initialText?: string;
  onApply?: (text: string) => void;
}

/**
 * Canvas: full-screen code/writing editor with a live HTML preview.
 * Used to open generated code (HTML) in an editable panel so the user
 * can tweak and instantly preview, then copy or continue chatting.
 */
export function CanvasScreen({ visible, onClose, initialText = "", onApply }: CanvasScreenProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState(initialText);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [copied, setCopied] = useState(false);
  const [html, setHtml] = useState<string>("");

  const isHtml = (content: string) => /<\s*(html|div|body|h[1-6]|p|button|form|table|head)/i.test(content);

  const doCopy = useCallback(async () => {
    try {
      const clipboard = await import("expo-clipboard");
      await clipboard.setStringAsync(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // web fallback unavailable — no-op
    }
  }, [text]);

  const doApply = () => {
    if (onApply) onApply(text);
    onClose();
  };

  const deriveHtml = () => {
    const t = text.trim();
    // If it's a full HTML doc, use as-is; otherwise wrap into a document.
    const htmlDoc = /<\s*html/i.test(t) ? t : `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:16px;font-family:system-ui,sans-serif;}</style></head><body>${t}</body></html>`;
    setHtml(htmlDoc);
    setTab("preview");
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>
          {/* Header */}
          <View className="flex-row items-center justify-between px-3 py-2 border-b border-border">
            <Text className="text-base font-bold text-foreground">Canvas</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <IconSymbol name="xmark" size={22} color={colors.foreground} />
            </Pressable>
          </View>

          {/* Tabs */}
          <View className="flex-row px-3 pt-2 gap-2">
            {(
              [
                { key: "edit", label: "Edit" },
                { key: "preview", label: "Preview" },
              ] as const
            ).map((t) => (
              <Pressable
                key={t.key}
                onPress={() => {
                  if (t.key === "preview") deriveHtml();
                  setTab(t.key);
                }}
                style={({ pressed }) => [
                  styles.tab,
                  {
                    backgroundColor: tab === t.key ? colors.primary : colors.surface,
                    borderColor: colors.border,
                  },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text
                  className={cn("text-xs font-semibold", tab === t.key ? "text-white" : "text-foreground")}
                >
                  {t.label}
                </Text>
              </Pressable>
            ))}
            {isHtml(text) && tab === "edit" && (
              <Pressable
                onPress={deriveHtml}
                style={({ pressed }) => [
                  styles.tab,
                  { borderColor: colors.border, backgroundColor: colors.surface },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <IconSymbol name="eye.fill" size={13} color={colors.primary} />
                <Text className="text-xs font-semibold text-primary ml-1">Live</Text>
              </Pressable>
            )}
          </View>

          {tab === "edit" ? (
            <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 12 }}>
              <TextInput
                className="text-foreground"
                multiline
                autoCapitalize="none"
                autoCorrect={false}
                value={text}
                onChangeText={setText}
                placeholder="Paste or edit code / text here…"
                placeholderTextColor={colors.muted}
                style={[styles.editor, { backgroundColor: colors.surface, color: colors.foreground, borderColor: colors.border }]}
              />
            </ScrollView>
          ) : (
            <View style={{ flex: 1, margin: 12 }}>
              <WebView
                originWhitelist={["*"]}
                source={{ html }}
                style={{ backgroundColor: "#ffffff" }}
                startInLoadingState
                renderLoading={() => (
                  <View style={styles.loadingCenter}>
                    <ActivityIndicator color={colors.primary} />
                  </View>
                )}
              />
            </View>
          )}

          {/* Footer */}
          <View className="flex-row items-center justify-between px-3 py-2 border-t border-border gap-2">
            <Pressable
              onPress={doCopy}
              style={({ pressed }) => [styles.footerBtn, { borderColor: colors.border }, pressed && { opacity: 0.7 }]}
            >
              <IconSymbol name="doc.on.doc" size={15} color={copied ? colors.success : colors.primary} />
              <Text className={cn("text-xs font-semibold ml-1", copied ? "text-success" : "text-primary")}>
                {copied ? "Copied" : "Copy"}
              </Text>
            </Pressable>
            <Pressable onPress={doApply} style={({ pressed }) => [styles.applyBtn, { backgroundColor: colors.primary }, pressed && { opacity: 0.85 }]}>
              <Text className="text-xs font-bold text-white">Use in Chat</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  tab: {
    borderWidth: 0.5,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
  },
  editor: {
    borderWidth: 0.5,
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    minHeight: 300,
    textAlignVertical: "top",
    lineHeight: 18,
  },
  footerBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 0.5,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  applyBtn: {
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  loadingCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});

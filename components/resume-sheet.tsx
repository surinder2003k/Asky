import { useState } from "react";
import {
  ActivityIndicator,
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
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

function haptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

interface ResumeSheetProps {
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

interface ResumeData {
  name: string;
  title: string;
  phone: string;
  email: string;
  location: string;
  summary: string;
  experience: string;
  education: string;
  skills: string;
}

export function ResumeSheet({ visible, onClose, onSaved }: ResumeSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<ResumeData>({
    name: "",
    title: "",
    phone: "",
    email: "",
    location: "",
    summary: "",
    experience: "",
    education: "",
    skills: "",
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const set = (k: keyof ResumeData, v: string) => setData((d) => ({ ...d, [k]: v }));

  const buildHtml = () => `
    <html><body style="font-family:Helvetica,Arial,sans-serif;color:#1f2937;max-width:640px;margin:0 auto;padding:32px">
      <h1 style="font-size:26px;margin:0 0 4px">${data.name || "Your Name"}</h1>
      <p style="font-size:15px;color:#6b7280;margin:0 0 10px">${data.title}</p>
      <p style="font-size:11px;color:#9ca3af;margin:0 0 18px">${[data.location, data.phone, data.email].filter(Boolean).join(" · ")}</p>
      ${data.summary ? `<h2 style="font-size:14px;border-bottom:1px solid #e5e7eb;padding-bottom:4px;margin:16px 0 8px;color:#111827">SUMMARY</h2><p style="font-size:12px;line-height:1.6;margin:0">${data.summary}</p>` : ""}
      ${data.experience ? `<h2 style="font-size:14px;border-bottom:1px solid #e5e7eb;padding-bottom:4px;margin:16px 0 8px;color:#111827">EXPERIENCE</h2><p style="font-size:12px;line-height:1.6;margin:0;white-space:pre-line">${data.experience}</p>` : ""}
      ${data.education ? `<h2 style="font-size:14px;border-bottom:1px solid #e5e7eb;padding-bottom:4px;margin:16px 0 8px;color:#111827">EDUCATION</h2><p style="font-size:12px;line-height:1.6;margin:0;white-space:pre-line">${data.education}</p>` : ""}
      ${data.skills ? `<h2 style="font-size:14px;border-bottom:1px solid #e5e7eb;padding-bottom:4px;margin:16px 0 8px;color:#111827">SKILLS</h2><p style="font-size:12px;line-height:1.6;margin:0">${data.skills}</p>` : ""}
    </body></html>`;

  const exportPdf = async () => {
    setLoading(true);
    haptic();
    try {
      const html = buildHtml();
      if (Platform.OS === "web") {
        await Print.printAsync({ html });
        setMsg("PDF printed");
        setTimeout(() => setMsg(null), 3000);
        onSaved?.();
        return;
      }
      // Native: render HTML to a PDF file, then share it.
      const result = await Print.printToFileAsync({ html, width: 612, height: 792 });
      if (result?.uri) {
        await Sharing.shareAsync(result.uri, { mimeType: "application/pdf" });
        setMsg("PDF ready — share it from the dialog");
      }
      setTimeout(() => setMsg(null), 3000);
      onSaved?.();
    } catch {
      setMsg("Could not export — please try again");
      setTimeout(() => setMsg(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const field = (label: string, value: string, onChange: (v: string) => void, opts: { multi?: boolean; placeholder?: string } = {}) => (
    <View className="gap-1">
      <Text className="text-[11px] font-semibold text-muted uppercase tracking-wide">{label}</Text>
      {opts.multi ? (
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={opts.placeholder}
          placeholderTextColor={colors.muted}
          multiline
          className="text-foreground text-[13px]"
          style={{
            backgroundColor: colors.background,
            borderColor: colors.border,
            borderWidth: 0.5,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
            minHeight: 72,
            textAlignVertical: "top",
          }}
        />
      ) : (
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={opts.placeholder}
          placeholderTextColor={colors.muted}
          returnKeyType="done"
          className="text-foreground text-[13px]"
          style={{
            backgroundColor: colors.background,
            borderColor: colors.border,
            borderWidth: 0.5,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        />
      )}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
          keyboardVerticalOffset={80}
        >
          <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border, paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
              <Text className="text-base font-bold text-foreground">Resume Builder</Text>
              <Pressable onPress={onClose} hitSlop={8} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
                <IconSymbol name="xmark" size={20} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView className="px-5" keyboardShouldPersistTaps="handled" style={{ maxHeight: "70%" }}>
              <View className="gap-3 pb-4">
                {field("Full Name", data.name, (v) => set("name", v), { placeholder: "Rahul Sharma" })}
                {field("Job Title", data.title, (v) => set("title", v), { placeholder: "Full Stack Developer" })}
                <View className="flex-row gap-2">
                  <View className="flex-1">{field("Phone", data.phone, (v) => set("phone", v), { placeholder: "+91 98XXX XXXXX" })}</View>
                  <View className="flex-1">{field("Email", data.email, (v) => set("email", v), { placeholder: "you@email.com" })}</View>
                </View>
                {field("Location", data.location, (v) => set("location", v), { placeholder: "Bengaluru, India" })}
                {field("Summary", data.summary, (v) => set("summary", v), { multi: true, placeholder: "2-3 lines about you…" })}
                {field("Experience", data.experience, (v) => set("experience", v), { multi: true, placeholder: "Company, Role, Dates — what you did\nCompany, Role, Dates — what you did" })}
                {field("Education", data.education, (v) => set("education", v), { multi: true, placeholder: "Degree — College, Year\nDegree — College, Year" })}
                {field("Skills", data.skills, (v) => set("skills", v), { multi: true, placeholder: "JavaScript · React · Node.js · Python" })}
              </View>
            </ScrollView>
            {msg ? (
              <Text className={`text-[11px] text-center mx-5 mb-1 ${msg.includes("ready") || msg.includes("printed") ? "text-success" : "text-error"}`}>{msg}</Text>
            ) : null}
            <View className="flex-row gap-2 px-5 pt-1">
              <Pressable
                onPress={() => {
                  haptic();
                  setPreviewOpen(true);
                }}
                style={({ pressed }) => ({
                  flex: 1,
                  alignItems: "center",
                  paddingVertical: 12,
                  borderRadius: 14,
                  borderWidth: 0.5,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text className="text-sm font-semibold text-foreground">Preview</Text>
              </Pressable>
              <Pressable
                onPress={exportPdf}
                disabled={loading}
                style={({ pressed }) => ({
                  flex: 1,
                  alignItems: "center",
                  paddingVertical: 12,
                  borderRadius: 14,
                  backgroundColor: loading ? colors.border : colors.primary,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={colors.background} />
                ) : (
                  <Text className="text-sm font-semibold text-background">Export PDF</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
      {/* Preview modal */}
      <Modal visible={previewOpen} animationType="slide" transparent onRequestClose={() => setPreviewOpen(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border, paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
              <Text className="text-base font-bold text-foreground">Resume Preview</Text>
              <Pressable onPress={() => setPreviewOpen(false)} hitSlop={8} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
                <IconSymbol name="xmark" size={20} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView className="px-5" style={{ maxHeight: "65%" }}>
              <View style={{ backgroundColor: "#ffffff", borderRadius: 8, padding: 20 }}>
                <Text style={{ fontSize: 20, fontWeight: "700", color: "#1f2937" }}>{data.name || "Your Name"}</Text>
                <Text style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{data.title}</Text>
                <Text style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>{[data.location, data.phone, data.email].filter(Boolean).join(" · ")}</Text>
                {data.summary ? <><Text style={styles.previewHead}>SUMMARY</Text><Text style={styles.previewBody}>{data.summary}</Text></> : null}
                {data.experience ? <><Text style={styles.previewHead}>EXPERIENCE</Text><Text style={styles.previewBody}>{data.experience}</Text></> : null}
                {data.education ? <><Text style={styles.previewHead}>EDUCATION</Text><Text style={styles.previewBody}>{data.education}</Text></> : null}
                {data.skills ? <><Text style={styles.previewHead}>SKILLS</Text><Text style={styles.previewBody}>{data.skills}</Text></> : null}
              </View>
            </ScrollView>
            <View className="px-5 pt-3">
              <Pressable
                onPress={exportPdf}
                disabled={loading}
                style={({ pressed }) => ({
                  alignItems: "center",
                  paddingVertical: 12,
                  borderRadius: 14,
                  backgroundColor: loading ? colors.border : colors.primary,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={colors.background} />
                ) : (
                  <Text className="text-sm font-semibold text-background">Export as PDF</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 0.5,
    maxHeight: "88%",
  },
  previewHead: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
    marginTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingBottom: 2,
  },
  previewBody: {
    fontSize: 11,
    color: "#374151",
    lineHeight: 17,
    marginTop: 4,
  },
});

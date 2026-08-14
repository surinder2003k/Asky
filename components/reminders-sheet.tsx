import { useState } from "react";
import {
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { scheduleReminder } from "@/lib/notifications";
import { deleteReminder, getReminders, saveReminder } from "@/lib/storage";
function nanoId(size = 10): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < size; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

interface ReminderItem {
  id: string;
  text: string;
  at: number;
}

interface RemindersSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Default reminder text, e.g. the last assistant message summary */
  defaultText?: string;
}

const PRESETS = [
  { label: "10 min", minutes: 10 },
  { label: "30 min", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "Tomorrow 9 AM", custom: () => {
      const t = new Date();
      t.setDate(t.getDate() + 1);
      t.setHours(9, 0, 0, 0);
      return t.getTime();
    } },
];

function haptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

export function RemindersSheet({ visible, onClose, defaultText }: RemindersSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState(defaultText ?? "");
  const [minutes, setMinutes] = useState<string>("");
  const [status, setStatus] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [existing, setExisting] = useState<ReminderItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refreshList = () => {
    void getReminders().then((map) =>
      setExisting(
        Object.entries(map)
          .map(([id, r]) => ({ id, text: r.text, at: r.at }))
          .filter((r) => r.at > Date.now())
          .sort((a, b) => a.at - b.at),
      ),
    );
    setLoaded(true);
  };

  const schedule = async (whenMs: number, presetLabel?: string) => {
    if (Platform.OS === "web") {
      setStatus({ type: "err", msg: "Reminders work on phone only." });
      return;
    }
    const trimmed = (text || "").trim();
    const label = trimmed ? trimmed : `Reminder${presetLabel ? ` (${presetLabel})` : ""}`;
    const id = nanoId(10);
    const notifId = await scheduleReminder({ id, text: label, at: whenMs });
    if (notifId) {
      await saveReminder(id, label, whenMs, parseInt(notifId, 10));
      setStatus({ type: "ok", msg: `Reminder set for ${new Date(whenMs).toLocaleString()}` });
      haptic();
    } else {
      setStatus({ type: "err", msg: "Could not schedule — notifications may be denied." });
    }
    void refreshList();
  };

  const remove = async (id: string) => {
    await deleteReminder(id);
    void refreshList();
    haptic();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()} style={{ flex: 1, justifyContent: "flex-end" }}>
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.background,
                paddingBottom: insets.bottom + 16,
                borderTopColor: colors.border,
              },
            ]}
          >
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <Text className="text-lg font-bold text-foreground px-4 pb-1">Reminders</Text>
            <Text className="text-xs text-muted px-4 pb-3">
              Get a local notification so you don't forget.
            </Text>

            <View style={{ paddingHorizontal: 16, gap: 8 }}>
              <TextInput
                className="text-foreground"
                placeholder="What should I remind you about?"
                placeholderTextColor={colors.muted}
                value={text}
                onChangeText={setText}
                style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface }]}
                multiline
              />
              <View className="flex-row flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <Pressable
                    key={p.label}
                    onPress={() => {
                      haptic();
                      const at = p.custom ? p.custom() : Date.now() + p.minutes * 60 * 1000;
                      void schedule(at, p.label);
                    }}
                    style={({ pressed }) => [
                      styles.preset,
                      { borderColor: colors.border, backgroundColor: colors.surface },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text className="text-xs font-semibold text-foreground">{p.label}</Text>
                  </Pressable>
                ))}
              </View>
              <View className="flex-row items-center gap-2">
                <TextInput
                  className="text-foreground"
                  placeholder="Custom minutes"
                  placeholderTextColor={colors.muted}
                  value={minutes}
                  onChangeText={setMinutes}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  style={[styles.customInput, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.foreground }]}
                />
                <Pressable
                  onPress={() => {
                    haptic();
                    const m = parseInt(minutes, 10);
                    if (!m || m <= 0) return;
                    void schedule(Date.now() + m * 60 * 1000, `${m} min`);
                  }}
                  style={({ pressed }) => [styles.goBtn, { backgroundColor: colors.primary }, pressed && { opacity: 0.8 }]}
                >
                  <Text className="text-xs font-bold text-white">Set</Text>
                </Pressable>
              </View>
              {status && (
                <Text className={status.type === "ok" ? "text-success text-xs" : "text-error text-xs"}>{status.msg}</Text>
              )}

              <View className="flex-row items-center mt-2">
                <Text className="text-xs font-semibold text-muted uppercase">Upcoming ({existing.length})</Text>
                <Pressable onPress={refreshList} hitSlop={6}>
                  <IconSymbol name="arrow.counterclockwise" size={13} color={colors.primary} />
                </Pressable>
              </View>
              {!loaded && (
                <Text className="text-xs text-muted">Loading…</Text>
              )}
              {loaded && existing.length === 0 && (
                <Text className="text-xs text-muted">No upcoming reminders.</Text>
              )}
              <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
                {existing.map((r) => (
                  <View
                    key={r.id}
                    style={[styles.reminderRow, { borderColor: colors.border, backgroundColor: colors.surface }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text className="text-[11px] font-semibold text-foreground" numberOfLines={1}>
                        {r.text}
                      </Text>
                      <Text className="text-[10px] text-muted mt-0.5">{new Date(r.at).toLocaleString()}</Text>
                    </View>
                    <Pressable onPress={() => void remove(r.id)} hitSlop={8}>
                      <IconSymbol name="trash.fill" size={15} color={colors.error} />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopWidth: 0.5,
    borderRadius: 20,
    paddingTop: 10,
    paddingBottom: 16,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 8,
  },
  input: {
    borderWidth: 0.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 44,
  },
  preset: {
    borderWidth: 0.5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  customInput: {
    flex: 1,
    borderWidth: 0.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    minHeight: 38,
  },
  goBtn: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 9,
    minHeight: 38,
    justifyContent: "center",
  },
  reminderRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 0.5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
    marginTop: 6,
  },
});

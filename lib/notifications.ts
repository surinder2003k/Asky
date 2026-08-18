import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Haptics from "expo-haptics";

import { deleteReminder } from "@/lib/storage";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
  }),
});

let channelReady = false;

async function ensureChannel() {
  if (Platform.OS === "android" && !channelReady) {
    try {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Reminders",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#10a37f",
      });
      channelReady = true;
    } catch {
      // channel setup failed — notifications may not show
    }
  }
}

/** Request notification permission (no-op on web). Returns true if usable. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return true;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === "granted") return true;
    const { status: requested } = await Notifications.requestPermissionsAsync();
    return requested === "granted";
  } catch {
    return false;
  }
}

export type ReminderDurationKey = "15m" | "30m" | "1h" | "1d" | "custom";

export const REMINDER_DURATIONS: { key: ReminderDurationKey; label: string; ms: number }[] = [
  { key: "15m", label: "15 minutes", ms: 15 * 60 * 1000 },
  { key: "30m", label: "30 minutes", ms: 30 * 60 * 1000 },
  { key: "1h", label: "1 hour", ms: 60 * 60 * 1000 },
  { key: "1d", label: "1 day", ms: 24 * 60 * 60 * 1000 },
];

export function formatReminderAt(at: number): string {
  const d = new Date(at);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hh = d.getHours();
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ampm = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 || 12;
  const time = `${h12}:${mm} ${ampm}`;
  if (sameDay) return `Today, ${time}`;
  return `${d.getDate()}/${d.getMonth() + 1} · ${time}`;
}

/**
 * Schedule a local reminder notification. Returns the notificationId.
 * Stores the reminder record in AsyncStorage and plays haptic on success.
 */
export async function scheduleReminder(params: {
  id: string;
  text: string;
  at: number;
}): Promise<string | null> {
  const { id, text, at } = params;
  if (at <= Date.now()) {
    await deleteReminder(id);
    return null;
  }
  const ok = await ensureNotificationPermission();
  await ensureChannel();
  if (!ok) {
    await deleteReminder(id);
    return null;
  }
  try {
    const notifId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Asky Reminder",
        body: text,
        data: { reminderId: id },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(at) } as any,
    });
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    return notifId;
  } catch {
    await deleteReminder(id);
    return null;
  }
}

/** Cancel a scheduled reminder by notificationId and remove its storage record. */
export async function cancelReminderById(notifId: string | number, reminderId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(String(notifId));
  } catch {
    // ignore
  }
  await deleteReminder(reminderId);
}

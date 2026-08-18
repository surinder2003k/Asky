import { Platform } from "react-native";

import { getReminders, saveReminder } from "@/lib/storage";
import { ensureNotificationPermission, scheduleReminder } from "@/lib/notifications";

/**
 * Called once on app start: re-schedules any reminders whose notificationId
 * was lost (e.g. after reinstall) so they fire again instead of being silently missed.
 * Clears reminders whose time has already passed.
 */
export async function initReminders(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const ok = await ensureNotificationPermission();
    if (!ok) return;
    const reminders = await getReminders();
    for (const [id, r] of Object.entries(reminders)) {
      if (!r || !r.at) continue;
      if (r.at <= Date.now()) {
        const { deleteReminder } = await import("@/lib/storage");
        await deleteReminder(id);
        continue;
      }
      // Only re-schedule if the reminder has no live notification registered
      if (r.notifId === undefined || r.notifId === null) {
        const notifId = await scheduleReminder({ id, text: r.text, at: r.at });
        if (notifId) await saveReminder(id, r.text, r.at, parseInt(notifId, 10));
      }
    }
  } catch {
    // best-effort initialization
  }
}

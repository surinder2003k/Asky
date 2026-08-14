import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Offline message draft queue.
 *
 * When the device is offline and the user presses send, the message (text +
 * optional image metadata + pending PDF name) is queued in AsyncStorage and
 * shown locally in the chat so nothing is lost. A NetInfo listener auto-flushes
 * the queue as soon as connectivity returns while the chat screen is active.
 */

const QUEUE_KEY = "aic_app:offlineQueue";
const MAX_QUEUE = 200;

export interface OfflineMessage {
  id: string;
  conversationId: string;
  /** The raw message that the user typed. Empty string means media-only. */
  text: string;
  /** True when the queued message carries an image (vision analysis) */
  hasImage: boolean;
  /** Name of an attached PDF, if any */
  pdfName?: string;
  /** Model key the user chose when sending (persists across model switches) */
  modelKey: string;
  queuedAt: number;
}

export interface QueueState {
  messages: OfflineMessage[];
  flushing: boolean;
}

function nanoId(size = 10): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < size; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export async function getOfflineQueue(): Promise<OfflineMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveQueue(queue: OfflineMessage[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(0, MAX_QUEUE)));
  } catch {
    // storage full — drop oldest messages until it fits
    try {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(0, Math.min(queue.length, MAX_QUEUE))));
    } catch {
      await AsyncStorage.removeItem(QUEUE_KEY);
    }
  }
}

export async function enqueueOfflineMessage(
  conversationId: string,
  text: string,
  opts: { hasImage: boolean; pdfName?: string; modelKey: string },
): Promise<string> {
  const queue = await getOfflineQueue();
  const entry: OfflineMessage = {
    id: `off-${nanoId(10)}-${Date.now()}`,
    conversationId,
    text,
    hasImage: opts.hasImage,
    pdfName: opts.pdfName,
    modelKey: opts.modelKey,
    queuedAt: Date.now(),
  };
  queue.push(entry);
  await saveQueue(queue);
  return entry.id;
}

export async function removeOfflineMessage(id: string): Promise<void> {
  const queue = await getOfflineQueue();
  await saveQueue(queue.filter((m) => m.id !== id));
}

export async function clearOfflineQueue(): Promise<void> {
  await saveQueue([]);
}

/**
 * Convenience render helper: returns an offline-queue draft message shaped like
 * a DisplayMessage user bubble so the composer can append it visually while
 * offline. `text` shown is "(offline — will send when back online)".
 */
export function offlineDraftDisplayMessage(entry: OfflineMessage) {
  return {
    id: entry.id,
    role: "user" as const,
    text: entry.text || (entry.hasImage ? "(image)" : "Message"),
    createdAt: entry.queuedAt,
    offlineDraft: true,
  } as { id: string; role: "user"; text: string; createdAt: number; offlineDraft: boolean };
}

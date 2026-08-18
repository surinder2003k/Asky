import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

import { createTRPCClient } from "@/lib/trpc";
import {
  AUTO_DELETE_DAYS,
  type Conversation,
  getConversations,
  setRawConversationList,
} from "@/lib/storage";

const SESSION_KEY = "aic_app:syncSessionId";
const SYNC_ENABLED_KEY = "aic_app:cloudSyncEnabled";
const DAY_MS = 24 * 60 * 60 * 1000;

let _sessionId: string | null = null;

function randomSessionId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 16; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export async function getSyncSessionId(): Promise<string> {
  if (_sessionId) return _sessionId;
  try {
    let id = await AsyncStorage.getItem(SESSION_KEY);
    if (!id) {
      id = randomSessionId();
      await AsyncStorage.setItem(SESSION_KEY, id);
    }
    _sessionId = id;
    return id;
  } catch {
    return randomSessionId();
  }
}

export async function getCloudSyncEnabled(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(SYNC_ENABLED_KEY);
    return v === "1";
  } catch {
    return false;
  }
}

export async function setCloudSyncEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(SYNC_ENABLED_KEY, enabled ? "1" : "0");
  } catch {
    // ignore
  }
}

function conversationToPushItem(conv: Conversation) {
  const messagesJson = JSON.stringify(
    conv.messages.map(({ role, text, createdAt }) => ({
      role,
      text,
      createdAt,
      // images are local-only; mark which messages had them
      hasImage: Boolean(conv.messages.find((m) => m.id === undefined) || false),
    })),
  );
  return {
    convId: conv.id,
    title: conv.title,
    modelKey: conv.modelKey,
    messagesJson,
    updatedAt: String(conv.updatedAt),
  };
}

/**
 * Merge pulled cloud rows into local storage (last-write-wins by updatedAt).
 * Expired rows (beyond the 3-day retention window) are skipped on pull — local policy still applies.
 */
function mergePulled(
  local: Conversation[],
  pulled: Array<{
    convId: string;
    title: string | null;
    modelKey: string | null;
    messagesJson: string | null;
    updatedAt: string;
  }>,
): Conversation[] {
  const localById = new Map(local.map((c) => [c.id, c]));
  const now = Date.now();
  for (const row of pulled) {
    const ts = parseInt(row.updatedAt, 10);
    if (!Number.isFinite(ts)) continue;
    if (now - ts > AUTO_DELETE_DAYS * DAY_MS) continue; // cloud rows respect the 3-day retention policy
    const localConv = localById.get(row.convId);
    if (localConv && localConv.updatedAt >= ts) continue; // local is newer
    let messages: Conversation["messages"] = [];
    if (row.messagesJson) {
      try {
        const raw = JSON.parse(row.messagesJson) as Array<Record<string, unknown>>;
        if (Array.isArray(raw)) {
          messages = raw
            .filter((m) => typeof m.text === "string" && (m.role === "user" || m.role === "assistant"))
            .map((m, idx) => ({
              id: `cloud-${row.convId}-${idx}-${Math.random().toString(36).slice(2, 8)}`,
              role: m.role as "user" | "assistant",
              text: m.text as string,
              createdAt: typeof m.createdAt === "number" ? m.createdAt : ts,
            }));
        }
      } catch {
        messages = [];
      }
    }
    localById.set(row.convId, {
      id: row.convId,
      title: row.title || "New Chat",
      modelKey: row.modelKey || "mistral/mistral-small-latest",
      messages,
      createdAt: Math.min(ts, localConv?.createdAt ?? ts),
      updatedAt: ts,
    });
  }
  return Array.from(localById.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

let syncInFlight = false;
let syncScheduled = false;

/** Request a sync cycle (debounced — multiple requests collapse into one). */
export function requestSync(): void {
  if (syncInFlight) {
    syncScheduled = true;
    return;
  }
  void runSync();
}

async function runSync(): Promise<void> {
  const enabled = await getCloudSyncEnabled();
  if (!enabled) return;
  syncInFlight = true;
  try {
    const sessionId = await getSyncSessionId();
    const local = await getConversations();

    // Everything locally modified gets pushed (server filters by updatedAt)
    const push = local.map(conversationToPushItem);

    const client = createTRPCClient();
    const result = await client.chats.sync.mutate({
      sessionId,
      appVersion: Constants.expoConfig?.version ?? "1.0.0",
      push,
      deletedIds: [],
    });

    const merged = mergePulled(local, result.pulled);
    await setRawConversationList(merged);
  } catch {
    // network/server unavailable — local data stays untouched
  } finally {
    syncInFlight = false;
    if (syncScheduled) {
      syncScheduled = false;
      void runSync();
    }
  }
}

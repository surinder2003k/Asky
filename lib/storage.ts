import AsyncStorage from "@react-native-async-storage/async-storage";
import { PROVIDERS, DEFAULT_MODEL_KEY } from "./providers";
import type { ChatMode } from "./modes";

const KEY_PREFIX = "aic_app:";
const DAY_MS = 24 * 60 * 60 * 1000;
export const AUTO_DELETE_DAYS = 3;

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: number;
  imageUri?: string;
  imageThumbUri?: string;
  error?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  modelKey: string;
  messages: ConversationMessage[];
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
  folderId?: string;
  templateId?: string;
  archived?: boolean;
  /** Specialized mode for this chat (deep research, translator, etc.) */
  chatMode?: ChatMode;
  /** Target language for translator mode */
  translateTarget?: string;
}

export interface ChatFolder {
  id: string;
  name: string;
  createdAt: number;
}

export interface Settings {
  modelKey: string;
}

function nanoId(size = 12): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < size; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

async function getRaw(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY_PREFIX + key);
  } catch {
    return null;
  }
}

async function setRaw(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_PREFIX + key, value);
  } catch {
    // storage full or unavailable
  }
}

async function delRaw(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY_PREFIX + key);
  } catch {
    // ignore
  }
}

export async function getSettings(): Promise<Settings> {
  const raw = await getRaw("settings");
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return { modelKey: parsed.modelKey ?? DEFAULT_MODEL_KEY };
    } catch {
      return { modelKey: DEFAULT_MODEL_KEY };
    }
  }
  return { modelKey: DEFAULT_MODEL_KEY };
}

export async function setSettings(settings: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  await setRaw("settings", JSON.stringify({ ...current, ...settings }));
}

export async function getApiKey(providerKey: string): Promise<string> {
  return (await getRaw(`keys:${providerKey}`)) ?? "";
}

export async function setApiKey(providerKey: string, key: string): Promise<void> {
  if (key.trim().length === 0) {
    await delRaw(`keys:${providerKey}`);
    return;
  }
  await setRaw(`keys:${providerKey}`, key.trim());
}

export async function getCustomSystemPrompt(): Promise<string> {
  return (await getRaw("customSystemPrompt")) ?? "";
}

export async function setCustomSystemPrompt(value: string): Promise<void> {
  await setRaw("customSystemPrompt", value.trim());
}

export type AccentKey = "teal" | "blue" | "purple";

const APP_LOCK_KEY = "asky:applock:enabled";

export async function getAppLockEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(APP_LOCK_KEY);
    return raw === "1";
  } catch {
    return false;
  }
}

export async function setAppLockEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(APP_LOCK_KEY, enabled ? "1" : "0");
}

export async function getAccent(): Promise<AccentKey> {
  const raw = await getRaw("accent");
  if (raw === "teal" || raw === "blue" || raw === "purple") return raw;
  return "teal";
}

export async function setAccent(accent: AccentKey): Promise<void> {
  await setRaw("accent", accent);
}

/**
 * Persisted theme scheme: "dark" | "light" | "system".
 * Defaults to "dark" (ChatGPT-style). "system" means follow the device.
 */
export type SchemeChoice = "dark" | "light" | "system";

export async function getScheme(): Promise<SchemeChoice> {
  const raw = await getRaw("scheme");
  if (raw === "dark" || raw === "light" || raw === "system") return raw;
  return "dark";
}

export async function setScheme(scheme: SchemeChoice): Promise<void> {
  await setRaw("scheme", scheme);
}

export async function getAllKeys(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const p of PROVIDERS) {
    out[p.key] = await getApiKey(p.key);
  }
  return out;
}

export function isExpired(conv: Conversation, now = Date.now()): boolean {
  // Archived chats auto-archive 1 day before expiry; pinned chats never auto-delete.
  // Auto-archive moves them to archive (kept until user deletes them) 2 days before
  // the 3-day expiry, so nothing is ever lost silently.
  if (conv.pinned) return false;
  const age = now - conv.updatedAt;
  if (age > AUTO_DELETE_DAYS * DAY_MS) return true;
  if (!conv.archived && age > (AUTO_DELETE_DAYS - 1) * DAY_MS) {
    // will be auto-archived by caller after save
    (conv as Conversation & { __pendingArchive: true }).__pendingArchive = true;
  }
  return false;
}

export async function saveConversation(conv: Conversation): Promise<void> {
  const list = await getConversations();
  const next = list.map((c) => (c.id === conv.id ? conv : c));
  if (!list.some((c) => c.id === conv.id)) next.unshift(conv);
  await setRawConversationList(next);
}

export async function renameConversation(id: string, title: string): Promise<void> {
  const list = await getConversations();
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1) return;
  list[idx].title = title.trim() || list[idx].title;
  list[idx].updatedAt = Date.now();
  await setRaw("conversations", JSON.stringify(list));
}

export async function setRawConversationList(list: Conversation[]): Promise<void> {
  await setRaw("conversations", JSON.stringify(list));
}

export async function getConversations(): Promise<Conversation[]> {
  const raw = await getRaw("conversations");
  if (!raw) return [];
  try {
    let list: Conversation[] = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    // Auto-delete conversations older than AUTO_DELETE_DAYS
    const now = Date.now();
    const kept: Conversation[] = [];
    let changed = false;
    for (const c of list) {
      if (isExpired(c, now)) {
        if ((c as Conversation & { __pendingArchive?: boolean }).__pendingArchive && !c.archived) {
          // Auto-archive: keep chat but hide from active history
          c.archived = true;
          changed = true;
          kept.push(c);
        } else {
          await delConversationImages(c);
          changed = true;
        }
      } else {
        kept.push(c);
      }
    }
    if (changed) {
      await setRaw("conversations", JSON.stringify(kept));
    }
    // Pinned chats always appear at the top, then newest first.
    return kept.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.updatedAt - a.updatedAt;
    });
  } catch {
    return [];
  }
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const list = await getConversations();
  return list.find((c) => c.id === id) ?? null;
}

// Generate a short title from the first user message (auto chat title)
export function titleFromFirstMessage(text: string): string {
  let t = text.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  if (t.length > 40) {
    const cut = t.slice(0, 40);
    const lastSpace = cut.lastIndexOf(" ");
    t = lastSpace > 20 ? cut.slice(0, lastSpace) : cut + "…";
  }
  return t || "New Chat";
}

export async function createConversation(modelKey: string): Promise<Conversation> {
  const now = Date.now();
  const conv: Conversation = {
    id: nanoId(12),
    title: "New Chat",
    modelKey,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  const list = await getConversations();
  await setRaw("conversations", JSON.stringify([conv, ...list]));
  return conv;
}

export async function addMessage(conversationId: string, msg: Omit<ConversationMessage, "id" | "createdAt">): Promise<void> {
  const list = await getConversations();
  const idx = list.findIndex((c) => c.id === conversationId);
  if (idx === -1) return;
  const now = Date.now();
  list[idx].messages.push({
    ...msg,
    id: nanoId(12),
    createdAt: now,
  });
  list[idx].updatedAt = now;
  if (list[idx].messages.length === 1 && msg.role === "user") {
    list[idx].title = titleFromFirstMessage(msg.text);
  }
  await setRaw("conversations", JSON.stringify(list));
}

export async function appendAssistantText(conversationId: string, text: string): Promise<void> {
  const list = await getConversations();
  const idx = list.findIndex((c) => c.id === conversationId);
  if (idx === -1) return;
  const msgs = list[idx].messages;
  const last = msgs[msgs.length - 1];
  if (last && last.role === "assistant" && !last.error) {
    last.text += text;
    list[idx].updatedAt = Date.now();
    await setRaw("conversations", JSON.stringify(list));
  }
}

export async function markAssistantError(conversationId: string, errorText: string): Promise<void> {
  const list = await getConversations();
  const idx = list.findIndex((c) => c.id === conversationId);
  if (idx === -1) return;
  const msgs = list[idx].messages;
  const last = msgs[msgs.length - 1];
  if (last && last.role === "assistant") {
    last.text = errorText;
    last.error = true;
    list[idx].updatedAt = Date.now();
  } else {
    msgs.push({
      id: nanoId(12),
      role: "assistant",
      text: errorText,
      error: true,
      createdAt: Date.now(),
    });
  }
  await setRaw("conversations", JSON.stringify(list));
}

export async function pinConversation(id: string, pinned: boolean): Promise<void> {
  const list = await getConversations();
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1) return;
  list[idx].pinned = pinned;
  await setRaw("conversations", JSON.stringify(list));
}

// ---------- Chat archive ----------

export async function archiveConversation(id: string, archived: boolean): Promise<void> {
  const list = await getConversations();
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1) return;
  list[idx].archived = archived;
  await setRaw("conversations", JSON.stringify(list));
}

export async function getArchivedConversations(): Promise<Conversation[]> {
  const all = await getConversations();
  return all.filter((c) => c.archived);
}

export async function duplicateConversation(id: string, modelKey?: string): Promise<Conversation | null> {
  const src = await getConversation(id);
  if (!src) return null;
  const conv: Conversation = {
    ...src,
    id: nanoId(12),
    title: src.title + " (copy)",
    modelKey: modelKey ?? src.modelKey,
    pinned: false,
    archived: false,
    folderId: undefined,
    templateId: undefined,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const list = await getConversations();
  await setRaw("conversations", JSON.stringify([conv, ...list]));
  return conv;
}

// ---------- Local reminders (expo-notifications local scheduling) ----------

export async function getReminders(): Promise<Record<string, { text: string; at: number; notifId?: number }>> {
  const raw = await getRaw("reminders");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function saveReminder(id: string, text: string, at: number, notifId?: number): Promise<void> {
  const all = await getReminders();
  all[id] = { text, at, notifId };
  await setRaw("reminders", JSON.stringify(all));
}

export async function deleteReminder(id: string): Promise<void> {
  const all = await getReminders();
  delete all[id];
  await setRaw("reminders", JSON.stringify(all));
}

// ---------- Usage stats (lightweight per-model counters) ----------

export interface UsageStats {
  [modelKey: string]: { messages: number; chars: number; lastUsed: number };
}

export async function getUsageStats(): Promise<UsageStats> {
  const raw = await getRaw("usage-stats");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function recordUsage(modelKey: string, chars: number): Promise<void> {
  const stats = await getUsageStats();
  const entry = stats[modelKey] ?? { messages: 0, chars: 0, lastUsed: 0 };
  entry.messages += 1;
  entry.chars += chars;
  entry.lastUsed = Date.now();
  stats[modelKey] = entry;
  await setRaw("usage-stats", JSON.stringify(stats));
}

export async function resetUsageStats(): Promise<void> {
  await setRaw("usage-stats", JSON.stringify({}));
}

// ---------- Chat folders ----------

export async function getFolders(): Promise<ChatFolder[]> {
  const raw = await getRaw("folders");
  if (!raw) return [];
  try {
    const list: ChatFolder[] = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function addFolder(name: string): Promise<ChatFolder> {
  const list = await getFolders();
  const folder: ChatFolder = { id: nanoId(10), name: name.trim() || "Folder", createdAt: Date.now() };
  await setRaw("folders", JSON.stringify([...list, folder]));
  return folder;
}

export async function renameFolder(id: string, name: string): Promise<void> {
  const list = await getFolders();
  const idx = list.findIndex((f) => f.id === id);
  if (idx === -1) return;
  list[idx].name = name.trim() || list[idx].name;
  await setRaw("folders", JSON.stringify(list));
}

export async function deleteFolder(id: string): Promise<void> {
  const list = await getConversations();
  for (const c of list) {
    if (c.folderId === id) delete c.folderId;
  }
  await setRaw("conversations", JSON.stringify(list));
  const folders = (await getFolders()).filter((f) => f.id !== id);
  await setRaw("folders", JSON.stringify(folders));
}

export async function moveConversationToFolder(convId: string, folderId: string | null): Promise<void> {
  const list = await getConversations();
  const idx = list.findIndex((c) => c.id === convId);
  if (idx === -1) return;
  if (folderId) list[idx].folderId = folderId;
  else delete list[idx].folderId;
  await setRaw("conversations", JSON.stringify(list));
}

export async function setConversationTemplate(convId: string, templateId: string | null): Promise<void> {
  const list = await getConversations();
  const idx = list.findIndex((c) => c.id === convId);
  if (idx === -1) return;
  if (templateId) list[idx].templateId = templateId;
  else delete list[idx].templateId;
  await setRaw("conversations", JSON.stringify(list));
}

export async function setConversationMode(convId: string, chatMode: ChatMode, translateTarget?: string): Promise<void> {
  const list = await getConversations();
  const idx = list.findIndex((c) => c.id === convId);
  if (idx === -1) return;
  list[idx].chatMode = chatMode;
  list[idx].translateTarget = translateTarget;
  await setRaw("conversations", JSON.stringify(list));
}

export async function deleteConversation(id: string): Promise<void> {
  const list = await getConversations();
  const conv = list.find((c) => c.id === id);
  if (conv) await delConversationImages(conv);
  await setRaw("conversations", JSON.stringify(list.filter((c) => c.id !== id)));
}

export async function clearConversations(): Promise<void> {
  const list = await getConversations();
  for (const conv of list) await delConversationImages(conv);
  await setRaw("conversations", JSON.stringify([]));
}

// ---------- Export / Import ----------

export interface ExportPayload {
  version: 1;
  exportedAt: number;
  folders: ChatFolder[];
  conversations: Conversation[];
}

export async function exportAllChats(): Promise<string> {
  const [folders, conversations] = await Promise.all([getFolders(), getConversations()]);
  const payload: ExportPayload = {
    version: 1,
    exportedAt: Date.now(),
    folders,
    conversations: conversations.map((c) => ({
      ...c,
      // Strip image URIs: images are local files, can't transfer between devices
      messages: c.messages.map((m) => ({
        ...m,
        imageUri: undefined,
        imageThumbUri: undefined,
      })),
    })),
  };
  return JSON.stringify(payload, null, 2);
}

export interface ImportResult {
  importedChats: number;
  skippedChats: number;
  importedFolders: number;
}

// Merge imported chats into local storage; duplicate ids or identical first messages are skipped
export async function importChats(json: string): Promise<ImportResult> {
  const parsed = JSON.parse(json);
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.conversations)) {
    throw new Error("Invalid Asky export file (version 1 expected)");
  }
  const importedFolders: ChatFolder[] = Array.isArray(parsed.folders) ? parsed.folders : [];
  const importedConvs: Conversation[] = parsed.conversations;
  const localFolders = await getFolders();
  const localConvs = await getConversations();

  // Folder id map: new id -> existing local id if same name, else keep new id (with collision safety)
  const folderNameToId = new Map(localFolders.map((f) => [f.name.toLowerCase(), f.id]));
  const usedFolderIds = new Set(localFolders.map((f) => f.id));
  const folderIdMap = new Map<string, string>();
  const mergedFolders = [...localFolders];
  for (const f of importedFolders) {
    const existing = folderNameToId.get(f.name.toLowerCase());
    if (existing) {
      folderIdMap.set(f.id, existing);
      continue;
    }
    let id = f.id;
    while (usedFolderIds.has(id)) id += "1";
    folderIdMap.set(f.id, id);
    usedFolderIds.add(id);
    mergedFolders.push({ id, name: f.name, createdAt: f.createdAt ?? Date.now() });
  }

  const localIds = new Set(localConvs.map((c) => c.id));
  const firstMessageSig = new Set(
    localConvs
      .map((c) => c.messages.find((m) => m.role === "user")?.text.trim().toLowerCase())
      .filter((s): s is string => !!s)
  );
  const usedIds = new Set(localIds);
  const mergedConvs = [...localConvs];
  let importedChats = 0;
  let skippedChats = 0;
  for (const c of importedConvs) {
    const sig = c.messages.find((m) => m.role === "user")?.text.trim().toLowerCase();
    if (localIds.has(c.id) || (sig && firstMessageSig.has(sig))) {
      skippedChats++;
      continue;
    }
    let id = c.id;
    while (usedIds.has(id)) id += "1";
    usedIds.add(id);
    const now = Date.now();
    mergedConvs.push({
      ...c,
      id,
      title: c.title || "Imported Chat",
      folderId: c.folderId ? folderIdMap.get(c.folderId) ?? c.folderId : undefined,
      pinned: !!c.pinned,
      messages: Array.isArray(c.messages)
        ? c.messages.map((m) => ({
            id: m.id && !usedIds.has(m.id) ? m.id : nanoId(12),
            role: m.role === "assistant" ? "assistant" : "user",
            text: m.text ?? "",
            createdAt: m.createdAt ?? Date.now(),
            imageUri: undefined,
            imageThumbUri: undefined,
            error: !!m.error,
          }))
        : [],
      createdAt: c.createdAt ?? now,
      updatedAt: now,
    });
    importedChats++;
  }

  await setRaw("folders", JSON.stringify(mergedFolders));
  await setRaw("conversations", JSON.stringify(mergedConvs));
  return {
    importedChats,
    skippedChats,
    importedFolders: importedFolders.filter((f) => !folderNameToId.has(f.name.toLowerCase())).length,
  };
}

async function delConversationImages(conv: Conversation): Promise<void> {
  for (const m of conv.messages) {
    if (m.imageUri) await delRaw(`img:${m.imageUri}`);
    if (m.imageThumbUri && m.imageThumbUri !== m.imageUri) await delRaw(`img:${m.imageThumbUri}`);
  }
}

// ---------- Reactions (like/dislike on assistant messages) ----------

/** Per-conversation reaction map: messageId -> "like" | "dislike" | null. Stored as JSON. */
const REACTION_KEY = "reactions";

export async function getReactions(): Promise<Record<string, Record<string, "like" | "dislike" | null>>> {
  const raw = await getRaw(REACTION_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function setReaction(convId: string, msgId: string, reaction: "like" | "dislike" | null): Promise<void> {
  const all = await getReactions();
  const convReactions = all[convId] ?? {};
  if (reaction) {
    convReactions[msgId] = reaction;
  } else {
    delete convReactions[msgId];
  }
  if (Object.keys(convReactions).length === 0) {
    delete all[convId];
  } else {
    all[convId] = convReactions;
  }
  await setRaw(REACTION_KEY, JSON.stringify(all));
}

// ---------- Saved prompts library ----------

export interface SavedPrompt {
  id: string;
  name: string;
  text: string;
  createdAt: number;
}

export async function getSavedPrompts(): Promise<SavedPrompt[]> {
  const raw = await getRaw("savedPrompts");
  if (!raw) return [];
  try {
    const list: SavedPrompt[] = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function savePrompt(name: string, text: string): Promise<SavedPrompt> {
  const list = await getSavedPrompts();
  const prompt: SavedPrompt = {
    id: nanoId(10),
    name: name.trim() || "Prompt",
    text: text.trim(),
    createdAt: Date.now(),
  };
  await setRaw("savedPrompts", JSON.stringify([...list, prompt]));
  return prompt;
}

export async function updatePrompt(id: string, name: string, text: string): Promise<void> {
  const list = await getSavedPrompts();
  const idx = list.findIndex((p) => p.id === id);
  if (idx === -1) return;
  list[idx].name = name.trim() || list[idx].name;
  list[idx].text = text.trim();
  await setRaw("savedPrompts", JSON.stringify(list));
}

export async function deletePrompt(id: string): Promise<void> {
  const list = (await getSavedPrompts()).filter((p) => p.id !== id);
  await setRaw("savedPrompts", JSON.stringify(list));
}

// ---------- TTS preferences ----------

export interface TtsPrefs {
  /** expo-speech voice identifier (platform specific). "" = default. */
  voice: string;
  /** Speech rate 0.5-1.5 (1 = normal) */
  rate: number;
}

const DEFAULT_TTS: TtsPrefs = { voice: "", rate: 1 };

export async function getTtsPrefs(): Promise<TtsPrefs> {
  const raw = await getRaw("ttsPrefs");
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return {
        voice: typeof parsed.voice === "string" ? parsed.voice : "",
        rate: typeof parsed.rate === "number" && parsed.rate >= 0.5 && parsed.rate <= 2 ? parsed.rate : 1,
      };
    } catch {
      return { ...DEFAULT_TTS };
    }
  }
  return { ...DEFAULT_TTS };
}

export async function setTtsPrefs(prefs: Partial<TtsPrefs>): Promise<void> {
  const current = await getTtsPrefs();
  await setRaw("ttsPrefs", JSON.stringify({ ...current, ...prefs }));
}

// ---------- Voice reply (auto read-aloud) ----------

export async function getAutoReadAloud(): Promise<boolean> {
  const raw = await getRaw("autoReadAloud");
  return raw === "true";
}

export async function setAutoReadAloud(enabled: boolean): Promise<void> {
  await setRaw("autoReadAloud", enabled ? "true" : "false");
}

// ---------- Model favorites ----------

export async function getFavoriteModels(): Promise<string[]> {
  const raw = await getRaw("favoriteModels");
  if (raw) {
    try {
      const list: string[] = JSON.parse(raw);
      return Array.isArray(list) ? list.filter((x) => typeof x === "string") : [];
    } catch {
      return [];
    }
  }
  return [];
}

export async function toggleFavoriteModel(modelKey: string): Promise<string[]> {
  const list = await getFavoriteModels();
  const idx = list.indexOf(modelKey);
  let next: string[];
  if (idx === -1) {
    if (list.length >= 10) {
      next = [...list.slice(1), modelKey]; // cap at 10 favorites
    } else {
      next = [...list, modelKey];
    }
  } else {
    next = list.filter((_, i) => i !== idx);
  }
  await setRaw("favoriteModels", JSON.stringify(next));
  return next;
}

// ---------- Model presets (named model configs) ----------

export interface ModelPreset {
  id: string;
  name: string;
  modelKey: string;
  templateId?: string;
  chatMode?: ChatMode;
  translateTarget?: string;
}

export async function getModelPresets(): Promise<ModelPreset[]> {
  const raw = await getRaw("modelPresets");
  if (!raw) return [];
  try {
    const list: ModelPreset[] = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function saveModelPreset(preset: Omit<ModelPreset, "id">): Promise<ModelPreset> {
  const list = await getModelPresets();
  const p: ModelPreset = { ...preset, id: nanoId(10) };
  const next = list.length >= 12 ? [...list.slice(1), p] : [...list, p];
  await setRaw("modelPresets", JSON.stringify(next));
  return p;
}

export async function deleteModelPreset(id: string): Promise<void> {
  const list = (await getModelPresets()).filter((p) => p.id !== id);
  await setRaw("modelPresets", JSON.stringify(list));
}

// ---------- Theme expansion (OLED black / sepia) ----------

export type ColorTheme = "default" | "oled" | "sepia";

export async function getColorTheme(): Promise<ColorTheme> {
  const raw = await getRaw("colorTheme");
  if (raw === "oled" || raw === "sepia") return raw;
  return "default";
}

export async function setColorTheme(theme: ColorTheme): Promise<void> {
  await setRaw("colorTheme", theme);
}

// ---------- Font size ----------

export type FontSizeChoice = "small" | "medium" | "large";

export async function getFontSizeChoice(): Promise<FontSizeChoice> {
  const raw = await getRaw("fontSize");
  if (raw === "small" || raw === "medium" || raw === "large") return raw;
  return "medium";
}

export async function setFontSizeChoice(size: FontSizeChoice): Promise<void> {
  await setRaw("fontSize", size);
}

// ---------- PDF export of a single chat ----------

export interface ChatExportLine {
  role: "user" | "assistant";
  text: string;
  createdAt: number;
}

export function getChatExportLines(conv: Conversation): ChatExportLine[] {
  return conv.messages.map((m) => ({ role: m.role, text: m.text, createdAt: m.createdAt }));
}

/** Render a chat as plain markdown text (user can share/print/save as PDF via share sheet). */
export function renderChatMarkdown(conv: Conversation): string {
  const lines: string[] = [`# ${conv.title}`, ""];
  for (const m of conv.messages) {
    lines.push(`## ${m.role === "user" ? "You" : "Asky"} — ${new Date(m.createdAt).toLocaleString()}`);
    lines.push("");
    lines.push(m.text);
    lines.push("");
  }
  return lines.join("\n").trim();
}

// ---------- Batch 25: web search toggle ----------
export async function getWebSearchEnabled(): Promise<boolean> {
  return (await getRaw("webSearchEnabled")) === "1";
}
export async function setWebSearchEnabled(on: boolean): Promise<void> {
  await setRaw("webSearchEnabled", on ? "1" : "0");
}

// ---------- Batch 25: knowledge base docs ----------
export interface KbDoc {
  id: string;
  name: string;
  text: string;
  createdAt: number;
  active: boolean;
}
export async function getKbDocs(): Promise<KbDoc[]> {
  const raw = await getRaw("kbDocs");
  if (!raw) return [];
  try {
    return JSON.parse(raw) as KbDoc[];
  } catch {
    return [];
  }
}
export async function saveKbDoc(doc: Omit<KbDoc, "id" | "createdAt">): Promise<void> {
  const docs = await getKbDocs();
  docs.push({ ...doc, id: nanoId(8), createdAt: Date.now() });
  await setRaw("kbDocs", JSON.stringify(docs));
}
export async function deleteKbDoc(id: string): Promise<void> {
  const docs = (await getKbDocs()).filter((d) => d.id !== id);
  await setRaw("kbDocs", JSON.stringify(docs));
}
export async function toggleKbDocActive(id: string): Promise<void> {
  const docs = (await getKbDocs()).map((d) => (d.id === id ? { ...d, active: !d.active } : d));
  await setRaw("kbDocs", JSON.stringify(docs));
}
export async function getActiveKbDocs(): Promise<KbDoc[]> {
  return (await getKbDocs()).filter((d) => d.active);
}
export async function getKbContextText(maxChars = 8000): Promise<string> {
  const docs = await getActiveKbDocs();
  if (docs.length === 0) return "";
  const header = "USER KNOWLEDGE BASE (use these facts when answering):\n";
  const parts = docs.map((d) => `--- ${d.name} ---\n${d.text}`);
  const joined = header + parts.join("\n\n");
  return joined.length > maxChars ? joined.slice(0, maxChars) + "\n...(truncated)" : joined;
}

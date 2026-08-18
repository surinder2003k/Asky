import type { ProviderKey } from "./providers";

const KEY_CHATS = "asky.chats";
const KEY_FOLDERS = "asky.folders";
const KEY_SETTINGS = "asky.settings";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  image?: string; // base64 data URL
  done?: boolean;
  error?: string;
  createdAt: number;
}

export interface Chat {
  id: string;
  title: string;
  folderId?: string | null;
  pinned?: boolean;
  messages: ChatMessage[];
  modelKey: string;
  createdAt: number;
  updatedAt: number;
}

export interface Folder {
  id: string;
  name: string;
  createdAt: number;
}

export interface Settings {
  apiKeys: Partial<Record<ProviderKey, string>>;
  theme: "dark" | "light";
  accent: "teal" | "blue" | "purple";
  pinEnabled: boolean;
  pinHash?: number; // simple hash of 4-6 digit pin
  customInstructions?: string;
  languagePreset?: string;
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / unavailable */
  }
}

export function loadChats(): Chat[] {
  return load<Chat[]>(KEY_CHATS, []);
}
export function saveChats(chats: Chat[]) {
  save(KEY_CHATS, chats);
}
export function loadFolders(): Folder[] {
  return load<Folder[]>(KEY_FOLDERS, []);
}
export function saveFolders(folders: Folder[]) {
  save(KEY_FOLDERS, folders);
}
export function loadSettings(): Settings {
  return load<Settings>(KEY_SETTINGS, {
    apiKeys: {},
    theme: "dark",
    accent: "teal",
    pinEnabled: false,
  });
}
export function saveSettings(settings: Settings) {
  save(KEY_SETTINGS, settings);
}

/** Delete chats older than 3 days, keep pinned ones. */
export function pruneExpiredChats() {
  const cutoff = Date.now() - 3 * 24 * 3600 * 1000;
  const chats = loadChats().filter((c) => c.pinned || c.updatedAt > cutoff);
  saveChats(chats);
  return chats;
}

/** Clear all chats but preserve pinned ones (matches UI promise). */
export function clearConversations() {
  const chats = loadChats().filter((c) => c.pinned);
  saveChats(chats);
}

export function genId(prefix = "c") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

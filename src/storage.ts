import type { ProviderKey } from "./providers";

const KEY_CHATS = "asky.chats";
const KEY_FOLDERS = "asky.folders";
const KEY_SETTINGS = "asky.settings";
export { KEY_CHATS, KEY_FOLDERS, KEY_SETTINGS };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  image?: string; // base64 data URL (primary)
  images?: string[]; // base64 data URLs (multi-image payload)
  replyTo?: string; // quoted message id
  sources?: { title: string; url: string }[]; // web-search source links shown under the answer
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
  systemPrompt?: string; // per-chat instructions, prepended at send time
  pinnedMsgIds?: string[]; // pinned message ids
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
  voiceLang?: "en" | "hi" | "hinglish";
  pinEnabled: boolean;
  pinHash?: number; // simple hash of 4-6 digit pin
  customInstructions?: string;
  languagePreset?: string;
  // Batch 62
  favoriteModelKeys?: string[]; // model keys starred in picker
  lastUsedModelKeys?: string[]; // recently used models, newest first (max 6)
  nicknames?: Record<string, string>; // model key -> custom short name
  customModels?: CustomModelDef[]; // user-added custom models
  templates?: PromptTemplate[]; // reusable prompt templates
  ttsEnabled?: boolean; // TTS speak button under assistant messages
  ttsRate?: number; // TTS playback rate (0.5-2)
  ttsLang?: string; // TTS language preference
  ttsVoiceName?: string; // pinned TTS voice
  chatWidth?: "compact" | "medium"; // chat container width
  fontSize?: "small" | "medium" | "large"; // message font size
  temperature?: number; // generation temperature
  topP?: number; // generation top_p
  voiceInputEnabled?: boolean; // mic in composer
}

export interface CustomModelDef {
  id: string;
  provider: string; // provider key, e.g. "openrouter"
  modelId: string; // upstream model id
  label: string; // display name
  vision?: boolean; // supports image analysis
  enabled?: boolean;
}

export interface PromptTemplate {
  id: string;
  name: string;
  content: string;
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
const DEFAULT_SETTINGS: Settings = {
  apiKeys: {},
  theme: "dark",
  accent: "teal",
  voiceLang: "en",
  pinEnabled: false,
  favoriteModelKeys: [],
  lastUsedModelKeys: [],
  nicknames: {},
  customModels: [],
  templates: [],
  ttsEnabled: false,
  ttsRate: 1,
  ttsLang: "en",
  chatWidth: "medium",
  fontSize: "medium",
  temperature: 0.7,
  topP: 1,
  voiceInputEnabled: true,
};

/**
 * Loads settings and deep-merges with defaults so a legacy settings object
 * (e.g. saved by an older app version that predates `apiKeys`) can never
 * leave `apiKeys` undefined — otherwise ModelChip and the model picker
 * crash with "Cannot read properties of undefined".
 */
export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY_SETTINGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const p = parsed as Settings;
        return {
          ...DEFAULT_SETTINGS,
          ...p,
          apiKeys: { ...DEFAULT_SETTINGS.apiKeys, ...(p.apiKeys || {}) },
          nicknames: { ...DEFAULT_SETTINGS.nicknames, ...(p.nicknames || {}) },
          favoriteModelKeys: Array.isArray(p.favoriteModelKeys) ? (p.favoriteModelKeys as string[]) : [],
          lastUsedModelKeys: Array.isArray(p.lastUsedModelKeys) ? (p.lastUsedModelKeys as string[]) : [],
          customModels: Array.isArray(p.customModels) ? (p.customModels as CustomModelDef[]) : [],
          templates: Array.isArray(p.templates) ? (p.templates as PromptTemplate[]) : [],
        };
      }
    }
  } catch {
    /* fall through to defaults */
  }
  return { ...DEFAULT_SETTINGS };
}
export function saveSettings(settings: Settings) {
  save(KEY_SETTINGS, settings);
}

/** Delete chats older than 5 days, keep pinned ones. */
export function pruneExpiredChats() {
  const cutoff = Date.now() - 5 * 24 * 3600 * 1000;
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

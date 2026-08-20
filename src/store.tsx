import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { loadChats, loadFolders, loadSettings, pruneExpiredChats, saveChats, saveFolders, saveSettings, genId, type Chat, type Folder, type Settings } from "./storage";
import { DEFAULT_MODEL_KEY } from "./providers";

interface AppState {
  chats: Chat[];
  folders: Folder[];
  settings: Settings;
  activeChatId: string | null;
  isLoaded: boolean;
}

interface Ctx extends AppState {
  activeChat: Chat | null;
  setActiveChatId: (id: string | null) => void;
  newChat: (modelKey?: string, folderId?: string | null) => Chat;
  createChat: (modelKey?: string, folderId?: string | null) => Chat;
  updateChat: (id: string, patch: Partial<Chat>) => void;
  updateMessage: (chatId: string, msgId: string, patch: Partial<import("./storage").ChatMessage> | ((m: import("./storage").ChatMessage) => Partial<import("./storage").ChatMessage>)) => void;
  deleteChat: (id: string) => void;
  renameChat: (id: string, title: string) => void;
  togglePin: (id: string) => void;
  moveChat: (id: string, folderId: string | null) => void;
  addFolder: (name: string) => Folder;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;
  setApiKeys: (keys: Partial<Settings["apiKeys"]>) => void;
  setTheme: (theme: Settings["theme"]) => void;
  setAccent: (accent: Settings["accent"]) => void;
  setVoiceLang: (voiceLang: NonNullable<Settings["voiceLang"]>) => void;
  setPinEnabled: (on: boolean, pinHash?: number) => void;
  setCustomInstructions: (v: string) => void;
  toggleFavorite: (modelKey: string) => void;
  recordModelUsed: (modelKey: string) => void;
  renameModel: (modelKey: string, nickname: string) => void;
  setCustomModels: (models: Settings["customModels"]) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  setTemplates: (templates: Settings["templates"]) => void;
  toggleMessagePin: (chatId: string, msgId: string) => void;
  moveFolder: (id: string, delta: 1 | -1) => void;
  clearConversations: () => void;
  importChat: (messages: import("./storage").ChatMessage[], title?: string, modelKey?: string) => void;
}

const AppContext = createContext<Ctx | null>(null);

function hashPin(pin: string): number {
  let h = 0;
  for (const ch of pin) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

export { hashPin };

export function AppProvider({ children }: { children: ReactNode }) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [settings, setSettingsState] = useState<Settings>(() => loadSettings());
  const [activeChatId, setActiveChatIdState] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const initDone = useRef(false);
  const importedId = useRef<string | null>(null);

  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;
    const c = pruneExpiredChats();
    const f = loadFolders();
    setChats(c);
    setFolders(f);
    // Homepage always opens on the empty "How can I help?" state. The last
    // active chat is NOT auto-restored — it stays in the sidebar history and
    // the user can open it explicitly. The only auto-open case is an imported
    // chat (deep link / import share) targeting a specific chat id.
    const active = importedId.current && c.some((x) => x.id === importedId.current)
      ? importedId.current
      : null;
    setActiveChatIdState(active);
    document.documentElement.setAttribute("data-theme", loadSettings().theme);
    document.documentElement.setAttribute("data-accent", loadSettings().accent);
    setIsLoaded(true);
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettingsState((s) => {
      const next = { ...s, ...patch };
      saveSettings(next);
      document.documentElement.setAttribute("data-theme", next.theme);
      document.documentElement.setAttribute("data-accent", next.accent);
      return next;
    });
  }, []);

  const syncChats = useCallback((updater: (prev: Chat[]) => Chat[]) => {
    setChats((prev) => {
      const next = updater(prev);
      saveChats(next);
      return next;
    });
  }, []);

  const activeChat = useMemo(() => chats.find((c) => c.id === activeChatId) || null, [chats, activeChatId]);

  const ctx = useMemo<Partial<Ctx>>(() => {
    const createChat = (modelKey?: string, folderId?: string | null): Chat => {
      const chat: Chat = {
        id: genId(),
        title: "New Chat",
        folderId: folderId ?? null,
        pinned: false,
        messages: [],
        modelKey: modelKey || DEFAULT_MODEL_KEY,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      syncChats((prev) => [chat, ...prev]);
      setActiveChatIdState(chat.id);
      return chat;
    };
    return {
      chats,
      folders,
      settings,
      activeChatId,
      activeChat,
      setActiveChatId: setActiveChatIdState,
      newChat: createChat,
      createChat,
      updateChat: (id, patch) =>
        syncChats((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c))),
      updateMessage: (chatId, msgId, patch) =>
        syncChats((prev) =>
          prev.map((c) =>
            c.id === chatId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === msgId ? { ...m, ...(typeof patch === "function" ? patch(m) : patch) } : m,
                  ),
                  updatedAt: Date.now(),
                }
              : c,
          ),
        ),
      deleteChat: (id) =>
        syncChats((prev) => prev.filter((c) => c.id !== id)),
      renameChat: (id, title) =>
        syncChats((prev) => prev.map((c) => (c.id === id ? { ...c, title, updatedAt: Date.now() } : c))),
      togglePin: (id) =>
        syncChats((prev) =>
          prev.map((c) => (c.id === id ? { ...c, pinned: !c.pinned, updatedAt: Date.now() } : c)),
        ),
      moveChat: (id, folderId) =>
        syncChats((prev) => prev.map((c) => (c.id === id ? { ...c, folderId, updatedAt: Date.now() } : c))),
      addFolder: (name) => {
        const folder: Folder = { id: genId("f"), name, createdAt: Date.now() };
        setFolders((prev) => {
          const next = [...prev, folder];
          saveFolders(next);
          return next;
        });
        return folder;
      },
      renameFolder: (id, name) =>
        setFolders((prev) => {
          const next = prev.map((f) => (f.id === id ? { ...f, name } : f));
          saveFolders(next);
          return next;
        }),
      deleteFolder: (id) => {
        setFolders((prev) => {
          const next = prev.filter((f) => f.id !== id);
          saveFolders(next);
          return next;
        });
        syncChats((prev) => prev.map((c) => (c.folderId === id ? { ...c, folderId: null, updatedAt: Date.now() } : c)));
      },
      setApiKeys: (keys) => updateSettings({ apiKeys: { ...settings.apiKeys, ...keys } }),
      setTheme: (theme) => updateSettings({ theme }),
      setAccent: (accent) => updateSettings({ accent }),
      setVoiceLang: (voiceLang) => updateSettings({ voiceLang }),
      setPinEnabled: (on, pinHash) => updateSettings({ pinEnabled: on, ...(on && pinHash ? { pinHash } : {}) }),
      setCustomInstructions: (v) => updateSettings({ customInstructions: v }),
      toggleFavorite: (modelKey) =>
        updateSettings({
          favoriteModelKeys: (settings.favoriteModelKeys ?? []).includes(modelKey)
            ? (settings.favoriteModelKeys ?? []).filter((k) => k !== modelKey)
            : [...(settings.favoriteModelKeys ?? []), modelKey],
        }),
      recordModelUsed: (modelKey) =>
        updateSettings({
          lastUsedModelKeys: [modelKey, ...(settings.lastUsedModelKeys ?? []).filter((k) => k !== modelKey)].slice(0, 6),
        }),
      renameModel: (modelKey, nickname) =>
        updateSettings({ nicknames: { ...settings.nicknames, [modelKey]: nickname } }),
      setCustomModels: (models) => updateSettings({ customModels: models ?? [] }),
      setTemplates: (templates) => updateSettings({ templates: templates ?? [] }),
      toggleMessagePin: (chatId, msgId) =>
        syncChats((prev) =>
          prev.map((c) => {
            if (c.id !== chatId) return c;
            const ids = c.pinnedMsgIds ?? [];
            return {
              ...c,
              pinnedMsgIds: ids.includes(msgId) ? ids.filter((x) => x !== msgId) : [...ids, msgId],
              updatedAt: Date.now(),
            };
          }),
        ),
      moveFolder: (id, delta) =>
        setFolders((prev) => {
          const idx = prev.findIndex((f) => f.id === id);
          if (idx < 0) return prev;
          const target = idx + delta;
          if (target < 0 || target >= prev.length) return prev;
          const next = [...prev];
          [next[idx], next[target]] = [next[target], next[idx]];
          saveFolders(next);
          return next;
        }),
      clearConversations: () => {
        syncChats((prev) => prev.filter((c) => c.pinned));
      },
      importChat: (messages, title, modelKey) => {
        const chat: Chat = {
          id: genId(),
          title: title?.trim() || "Shared chat",
          folderId: null,
          pinned: false,
          messages,
          modelKey: modelKey || DEFAULT_MODEL_KEY,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        importedId.current = chat.id;
        syncChats((prev) => [chat, ...prev]);
        setActiveChatIdState(chat.id);
      },
    };
  }, [chats, folders, settings, activeChatId, syncChats, updateSettings]);

  const finalCtx: Ctx = { ...ctx, isLoaded } as Ctx;

  return <AppContext.Provider value={finalCtx}>{children}</AppContext.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp outside provider");
  return ctx;
}

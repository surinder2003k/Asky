import { describe, it, expect, beforeEach } from "vitest";
import { MODELS, getModel, resolveModelId, DEFAULT_MODEL_KEY, PROVIDERS } from "../src/providers";
import { pruneExpiredChats, clearConversations, genId, loadSettings, saveChats, loadChats } from "../src/storage";

function newLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
    get length() { return store.size; },
    key: (i: number) => [...store.keys()][i] ?? null,
  } as Storage;
}

function mockLocalStorage(): void {
  Object.defineProperty(globalThis, "localStorage", {
    value: newLocalStorage(),
    configurable: true,
    writable: true,
  });
}

describe("providers", () => {
  it("has 22 verified models across 6 providers including the DeepSeek V4 family", () => {
    expect(MODELS.length).toBe(22);
    for (const k of ["opencode/deepseek-v4-pro", "opencode/deepseek-v4-flash", "opencode/deepseek-v4-flash-free"]) {
      expect(getModel(k)).toBeTruthy();
    }
    const keys = new Set(MODELS.map((m) => m.provider));
    expect(keys.size).toBe(6);
    expect(keys.has("nvidia")).toBe(true);
    expect(keys.has("mistral")).toBe(true);
    expect(keys.has("groq")).toBe(true);
    expect(keys.has("openrouter")).toBe(true);
    expect(keys.has("opencode")).toBe(true);
    expect(keys.has("gemini")).toBe(true);
  });

  it("every model has unique key", () => {
    const seen = new Set<string>();
    for (const m of MODELS) {
      expect(seen.has(m.key)).toBe(false);
      seen.add(m.key);
    }
  });

  it("getModel resolves known keys including default", () => {
    expect(getModel(DEFAULT_MODEL_KEY)).toBeTruthy();
    for (const m of MODELS) {
      expect(getModel(m.key)).toBe(m);
    }
    expect(getModel("nonexistent/xyz")).toBeUndefined();
  });

  it("resolveModelId sends full catalog id for keepPrefix models", () => {
    const vl = MODELS.find((m) => m.keepPrefix);
    if (vl) {
      expect(resolveModelId(vl)).toContain("/");
      const full = resolveModelId(vl).split("/");
      expect(full.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("nvidia text models are sent as bare ids", () => {
    const nvText = MODELS.filter((m) => m.provider === "nvidia" && !m.keepPrefix);
    expect(nvText.length).toBeGreaterThan(0);
    for (const m of nvText) {
      expect(resolveModelId(m)).not.toContain("nvidia/nvidia/");
      expect(resolveModelId(m).split("/").length).toBeLessThanOrEqual(2);
    }
  });

  it("no provider ships a built-in key (open-source: users bring their own) and all declare an auth header", () => {
    for (const p of Object.values(PROVIDERS)) {
      expect(p.hasBuiltInKey).toBeFalsy();
      expect(p.header).toMatch(/^Authorization$/);
      expect(p.url).toMatch(/^https:\/\//);
    }
  });
});

describe("storage", () => {
  beforeEach(() => {
    // Fresh localStorage per test — storage.ts caches nothing, re-reading each call.
    mockLocalStorage();
  });

  it("prunes chats older than 3 days unless pinned", () => {
    mockLocalStorage();
    const old = {
      id: genId("c"),
      title: "old",
      messages: [],
      pinned: false,
      createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
      updatedAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
    };
    const newChat = {
      id: genId("c"),
      title: "new",
      messages: [],
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const pinnedOld = {
      id: genId("c"),
      title: "pinned-old",
      messages: [],
      pinned: true,
      createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
      updatedAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
    };
    saveChats([old, newChat, pinnedOld]);
    pruneExpiredChats();
    const remaining = loadChats();
    expect(remaining.length).toBe(2);
    expect(remaining.find((c: any) => c.id === old.id)).toBeUndefined();
    expect(remaining.find((c: any) => c.id === pinnedOld.id)).toBeTruthy();
  });

  it("clearConversations preserves pinned chats", async () => {
    const storage = await import("../src/storage");
    const { saveChats, loadChats } = storage;
    const pinned = {
      id: genId("c"),
      title: "keep",
      messages: [],
      pinned: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    saveChats([pinned, { ...pinned, id: genId("c"), pinned: false, title: "gone" }]);
    clearConversations();
    const remaining = loadChats();
    expect(remaining.length).toBe(1);
    expect(remaining[0].pinned).toBe(true);
  });

  it("settings load default theme/accent/pin values", () => {
    mockLocalStorage();
    const s = loadSettings();
    expect(s.theme).toBe("dark");
    expect(["teal", "blue", "purple"]).toContain(s.accent);
    expect(s.pinEnabled).toBe(false);
    expect(s.apiKeys).toEqual({});
  });
});

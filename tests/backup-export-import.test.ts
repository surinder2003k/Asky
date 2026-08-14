import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock AsyncStorage so storage functions persist in-memory during tests
const store = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (k: string) => store.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    removeItem: vi.fn(async (k: string) => {
      store.delete(k);
    }),
  },
}));

// Mock providers module (only DEFAULT_MODEL_KEY and PROVIDERS used by storage)
vi.mock("@/lib/providers", () => ({
  PROVIDERS: [{ key: "mistral" }],
  DEFAULT_MODEL_KEY: "mistral/mistral-small-latest",
}));

import {
  addMessage as addMessageFn,
  addFolder as addFolderFn,
  createConversation as createConversationFn,
  deleteConversation as deleteConversationFn,
  exportAllChats as exportAllChatsFn,
  getConversations as getConversationsFn,
  getFolders as getFoldersFn,
  importChats as importChatsFn,
  setRawConversationList,
  titleFromFirstMessage as titleFromFirstMessageFn,
} from "../lib/storage";

beforeEach(() => {
  store.clear();
});

describe("titleFromFirstMessage", () => {
  it("uses the first user message as title (short)", () => {
    expect(titleFromFirstMessageFn("Hello there")).toBe("Hello there");
  });

  it("collapses newlines into a single space", () => {
    expect(titleFromFirstMessageFn("line one\nline two")).toBe("line one line two");
  });

  it("truncates long messages at a word boundary under 40 chars", () => {
    const long = "What is the capital of the country where cricket is the most popular sport in the world";
    const title = titleFromFirstMessageFn(long);
    expect(title.length).toBeLessThanOrEqual(40);
    expect(title.endsWith("…")).toBe(false);
    expect(title).toBe("What is the capital of the country");
  });

  it("falls back to ellipsis when no good word boundary exists", () => {
    const weird = "abcdefghijklmnopqrstuvwxyz1234567890abcdef";
    const title = titleFromFirstMessageFn(weird);
    expect(title.length).toBeLessThanOrEqual(41);
    expect(title.endsWith("…")).toBe(true);
  });

  it("returns New Chat for empty input", () => {
    expect(titleFromFirstMessageFn("   \n  ")).toBe("New Chat");
  });
});

describe("addMessage sets auto title", () => {
  it("titles a new chat from the first user message", async () => {
    const conv = await createConversationFn("mistral/mistral-small-latest");
    expect(conv.title).toBe("New Chat");
    await addMessageFn(conv.id, { role: "user", text: "Explain quantum entanglement" });
    const convs = await getConversationsFn();
    expect(convs[0].title).toBe("Explain quantum entanglement");
  });

  it("does not overwrite a custom title after first message exists", async () => {
    const conv = await createConversationFn("mistral/mistral-small-latest");
    await addMessageFn(conv.id, { role: "user", text: "First question" });
    const convs = await getConversationsFn();
    convs[0].title = "My Custom Title";
    await setRawConversationList(convs);
    await addMessageFn(conv.id, { role: "assistant", text: "Answer here" });
    const updated = await getConversationsFn();
    expect(updated[0].title).toBe("My Custom Title");
  });
});

describe("export / import", () => {
  it("exports folders and conversations as version 1 JSON", async () => {
    const conv = await createConversationFn("groq/mixtral-8x7b-32768");
    await addMessageFn(conv.id, { role: "user", text: "Say hi" });
    await addMessageFn(conv.id, { role: "assistant", text: "Hi there!" });
    await addFolderFn("Work");
    const convs = await getConversationsFn();
    await (async () => {
      const folders = await getFoldersFn();
      const list = await getConversationsFn();
      list[0].folderId = folders[0].id;
      list[0].pinned = true;
      await setRawConversationList(list);
    })();

    const json = await exportAllChatsFn();
    const payload = JSON.parse(json);
    expect(payload.version).toBe(1);
    expect(payload.conversations).toHaveLength(1);
    expect(payload.conversations[0].messages[0].imageUri).toBeUndefined();
    expect(payload.folders).toHaveLength(1);
    expect(payload.conversations[0].pinned).toBe(true);
  });

  it("imports chats into empty storage", async () => {
    const conv = await createConversationFn("mistral/mistral-small-latest");
    await addMessageFn(conv.id, { role: "user", text: "Old chat" });
    // Export, wipe, import
    const json = await exportAllChatsFn();
    await deleteConversationFn(conv.id);
    const result = await importChatsFn(json);
    expect(result.importedChats).toBe(1);
    expect(result.skippedChats).toBe(0);
    const convs = await getConversationsFn();
    expect(convs).toHaveLength(1);
    expect(convs[0].messages[0].text).toBe("Old chat");
    expect(convs[0].messages[0].imageUri).toBeUndefined();
  });

  it("skips duplicate chats by id or identical first message", async () => {
    const conv = await createConversationFn("mistral/mistral-small-latest");
    await addMessageFn(conv.id, { role: "user", text: "Same first message" });
    const json = await exportAllChatsFn();

    const result = await importChatsFn(json);
    expect(result.importedChats).toBe(0);
    expect(result.skippedChats).toBe(1);
    const convs = await getConversationsFn();
    expect(convs).toHaveLength(1);
  });

  it("merges imported chats with existing ones (no duplicates)", async () => {
    const conv = await createConversationFn("mistral/mistral-small-latest");
    await addMessageFn(conv.id, { role: "user", text: "Existing chat" });
    const otherConv = await createConversationFn("gemini/gemini-2.5-flash");
    await addMessageFn(otherConv.id, { role: "user", text: "Other chat" });
    // Export all chats, then wipe both locally to simulate a fresh phone
    const json = await exportAllChatsFn();
    await deleteConversationFn(conv.id);
    await deleteConversationFn(otherConv.id);
    expect(await getConversationsFn()).toHaveLength(0); // both wiped locally

    // Restore chat A from an older backup whose first message is identical to A's
    const olderBackup = {
      version: 1,
      exportedAt: 1,
      folders: [],
      conversations: [
        { id: "old-backup-a", title: "Existing chat", modelKey: "mistral/mistral-small-latest", messages: [{ id: "m1", role: "user", text: "Existing chat", createdAt: 1, updatedAt: 1 }], createdAt: 1, updatedAt: 1 },
      ],
    };
    const r1 = await importChatsFn(JSON.stringify(olderBackup));
    expect(r1.importedChats).toBe(1);

    // Now import the full export: chat A is skipped (identical first message), chat B is imported
    const result = await importChatsFn(json);
    expect(result.importedChats).toBe(1);
    expect(result.skippedChats).toBe(1);
    const convs = await getConversationsFn();
    expect(convs).toHaveLength(2);
    const titles = convs.map((c) => c.title).sort();
    expect(titles).toEqual(["Existing chat", "Other chat"]);
  });

  it("merges folders by name and remaps chat folderIds", async () => { // probe-log disabled here; keep test clean
    const conv = await createConversationFn("mistral/mistral-small-latest");
    await addMessageFn(conv.id, { role: "user", text: "Chat in folder" });
    await addFolderFn("Work");
    const folders = await getFoldersFn();
    const list = await getConversationsFn();
    const entry = list.find((c) => c.id === conv.id);
    if (entry) entry.folderId = folders[0].id;
    await setRawConversationList(list);

    const json = await exportAllChatsFn();
    await deleteConversationFn(conv.id);
    // Folder 'Work' still exists locally, so the imported folder is merged by name (importedFolders = 0 is correct)
    const result = await importChatsFn(json);
    expect(result.importedFolders).toBe(0);
    expect(result.importedChats).toBe(1);
    const convs = await getConversationsFn();
    expect(convs.find((c) => c.title === "Chat in folder")?.folderId).toBe(folders[0].id); // remapped to existing folder
  });

  it("rejects invalid export payloads", async () => {
    await expect(importChatsFn("not json")).rejects.toThrow();
    await expect(importChatsFn(JSON.stringify({ version: 2, conversations: [] }))).rejects.toThrow();
    await expect(importChatsFn(JSON.stringify({ version: 1 }))).rejects.toThrow();
  });
});

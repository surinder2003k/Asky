import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock AsyncStorage with an in-memory backing store so queue ops persist between calls
const store = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (k: string) => store.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => { store.set(k, v); }),
    removeItem: vi.fn(async (k: string) => { store.delete(k); }),
  },
}));

import * as offlineDraft from "../lib/offline-draft";
import { getModelSourceLabel } from "../lib/providers";

beforeEach(async () => {
  store.clear();
  await offlineDraft.clearOfflineQueue();
});

describe("offline-draft queue", () => {
  it("stores and retrieves queued messages", async () => {
    expect(await offlineDraft.getOfflineQueue()).toHaveLength(0);
    const id = await offlineDraft.enqueueOfflineMessage("conv-1", "hello offline", {
      hasImage: false,
      pdfName: undefined,
      modelKey: "mistral/mistral-small-latest",
    });
    expect(id).toBeTruthy();
    const queue = await offlineDraft.getOfflineQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].text).toBe("hello offline");
    expect(queue[0].conversationId).toBe("conv-1");
    expect(queue[0].modelKey).toBe("mistral/mistral-small-latest");
    expect(typeof queue[0].queuedAt).toBe("number");
  });

  it("removes a specific entry and preserves FIFO order", async () => {
    const id1 = await offlineDraft.enqueueOfflineMessage("conv-1", "first", { hasImage: false, modelKey: "a/b" });
    const id2 = await offlineDraft.enqueueOfflineMessage("conv-1", "second", { hasImage: false, modelKey: "a/b" });
    const id3 = await offlineDraft.enqueueOfflineMessage("conv-1", "third", { hasImage: false, modelKey: "a/b" });
    await offlineDraft.removeOfflineMessage(id2);
    const queue = await offlineDraft.getOfflineQueue();
    expect(queue.map((m) => m.text)).toEqual(["first", "third"]);
    void id1;
    void id3;
  });

  it("clears the whole queue", async () => {
    await offlineDraft.enqueueOfflineMessage("conv-1", "x", { hasImage: false, modelKey: "a/b" });
    await offlineDraft.enqueueOfflineMessage("conv-1", "y", { hasImage: false, modelKey: "a/b" });
    await offlineDraft.clearOfflineQueue();
    expect(await offlineDraft.getOfflineQueue()).toHaveLength(0);
  });

  it("produces a display message for the offline pill", () => {
    const msg = offlineDraft.offlineDraftDisplayMessage({
      id: "q1",
      conversationId: "conv-1",
      text: "hi there",
      hasImage: false,
      pdfName: undefined,
      modelKey: "a/b",
      queuedAt: 1000,
    });
    expect(msg.role).toBe("user");
    expect(msg.text).toBe("hi there");
    expect(msg.offlineDraft).toBe(true);
    expect(msg.id).toBe("q1");
  });
});

describe("getModelSourceLabel", () => {
  it("formats model name with provider label", () => {
    expect(getModelSourceLabel("mistral/mistral-small-latest")).toContain("Mistral Small");
    expect(getModelSourceLabel("opencode_zen/mimo-v2.5-free")).toContain("MiMo V2.5 Free");
    expect(getModelSourceLabel("groq/llama-3.3-70b-versatile")).toContain("Llama 3.3 70B");
  });

  it("falls back to the raw key for unknown models", () => {
    expect(getModelSourceLabel("unknown/missing-model-xyz")).toBe("unknown/missing-model-xyz");
  });
});

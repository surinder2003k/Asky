import { describe, expect, it } from "vitest";
import { chatWordCount } from "../src/export";
import type { Chat } from "../src/storage";

const chat: Chat = {
  id: "c1",
  title: "T",
  modelKey: "m1",
  folderId: undefined,
  pinned: false,
  updatedAt: Date.now(),
  messages: [
    { id: "m1", role: "user", content: "hello world", createdAt: Date.now() },
    { id: "m2", role: "assistant", content: "answer with seven words here today wow", done: true, createdAt: Date.now() },
  ],
};

describe("chatWordCount", () => {
  it("counts words and approximates tokens", () => {
    const { words, tokens } = chatWordCount(chat);
    expect(words).toBe(9);
    expect(tokens).toBeGreaterThan(words);
  });
});

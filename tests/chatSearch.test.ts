import { describe, expect, it } from "vitest";
import { searchInChat } from "../src/chatSearch";
import type { ChatMessage } from "../src/storage";

function msg(content: string, role: "user" | "assistant" = "user"): ChatMessage {
  return { id: `m-${content}`, role, content, done: true, createdAt: Date.now() };
}

describe("searchInChat", () => {
  it("finds matches across multiple messages case-insensitively", () => {
    const hits = searchInChat("banana", [msg("I love Bananas"), msg("answer", "assistant")]);
    expect(hits).toHaveLength(1);
    expect(hits[0].msgId).toBe("m-I love Bananas");
    expect(hits[0].snippet.toLowerCase()).toContain("banan");
  });

  it("ignores matches inside fenced code blocks", () => {
    const hits = searchInChat("secret", [msg("```js\nconst secret = 1;\n```\noutside")]);
    expect(hits).toHaveLength(0);
  });

  it("returns zero hits for empty query", () => {
    expect(searchInChat("", [msg("hello")])).toHaveLength(0);
  });
});

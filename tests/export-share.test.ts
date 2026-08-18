import { describe, expect, it } from "vitest";
import type { Chat } from "../src/storage";
import {
  encodeShareString,
  decodeShareString,
  parseSharedMessages,
  chatToPayload,
} from "../src/export";

function makeChat(overrides: Partial<Chat> = {}): Chat {
  return {
    id: "chat1",
    title: "Test chat",
    folderId: null,
    pinned: false,
    modelKey: "nvidia/z-ai/glm-5.2",
    messages: [
      { id: "m1", role: "user", content: "Hello", done: true, createdAt: 1 },
      { id: "m2", role: "assistant", content: "Hi there! **bold** and `code`.", done: true, createdAt: 2 },
      {
        id: "m3",
        role: "assistant",
        content: "```html\n<h1>Hello</h1>\n<script>alert(1)</script>\n```\n```\nplain\n```",
        done: true,
        createdAt: 3,
      },
    ],
    createdAt: 0,
    updatedAt: 100,
    ...overrides,
  };
}

describe("share link roundtrip", () => {
  it("encodes and decodes a chat payload", () => {
    const chat = makeChat();
    const s = encodeShareString(chat);
    expect(s.length).toBeGreaterThan(0);
    expect(s).not.toContain("+");
    expect(s).not.toContain("/");
    expect(s).not.toContain("=");
    const json = decodeShareString(s);
    const parsed = parseSharedMessages(json);
    expect(parsed.messages).toHaveLength(3);
    expect(parsed.messages[0].content).toBe("Hello");
    expect(parsed.messages[2].content).toContain("alert(1)");
  });

  it("trims oldest messages when payload exceeds the size cap", () => {
    const chat = makeChat({
      messages: Array.from({ length: 40 }, (_, i) => ({
        id: `m${i}`,
        role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
        content: `Message number ${i} with some padding text to make it longer.`,
        done: true,
        createdAt: i,
      })),
    });
    const s = encodeShareString(chat);
    expect(s.length).toBeLessThanOrEqual(1900);
    const json = decodeShareString(s);
    const parsed = parseSharedMessages(json);
    expect(parsed.messages.length).toBeGreaterThan(0);
    // newest messages preserved
    expect(parsed.messages[parsed.messages.length - 1].content).toContain("39");
  });

  it("rejects invalid share strings", () => {
    expect(() => decodeShareString("not-valid-base64!!!")).toThrow();
  });

  it("rejects malformed JSON payloads", () => {
    expect(() => parseSharedMessages("{invalid}")).toThrow();
    expect(() => parseSharedMessages('{"t":"x"}')).toThrow(); // missing m array
  });

  it("marks image attachments without carrying base64 data", () => {
    const chat = makeChat({
      messages: [
        { id: "m1", role: "user", content: "see this", image: "data:image/png;base64,REALLY_LONG_DATA", done: true, createdAt: 1 },
      ],
    });
    const payload = chatToPayload(chat);
    expect(payload.m[0].i).toBe(true);
    const parsed = parseSharedMessages(JSON.stringify(payload));
    expect(parsed.messages[0].image).toBe("");
  });
});

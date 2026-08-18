import { describe, expect, it } from "vitest";
import { chatToWhatsAppText } from "../src/export";
import type { Chat, ChatMessage } from "../src/store";

function makeChat(messages: ChatMessage[], title = "Test Chat", updatedAt = 1000000000000): Chat {
  return {
    id: "c1",
    title,
    updatedAt,
    messages,
  } as Chat;
}

describe("chatToWhatsAppText", () => {
  it("formats user messages with bold label and quoted text", () => {
    const chat = makeChat([
      { id: "m1", role: "user", content: "Hi bro", done: true },
    ]);
    const text = chatToWhatsAppText(chat);
    expect(text).toContain("*Test Chat*");
    expect(text).toContain("*You*");
    expect(text).toContain("> Hi bro");
  });

  it("formats assistant messages and errors", () => {
    const chat = makeChat([
      { id: "m1", role: "assistant", content: "Hello there!", done: true },
      { id: "m2", role: "assistant", content: "", done: true, error: "rate limited" },
    ]);
    const text = chatToWhatsAppText(chat);
    expect(text).toContain("*Asky*");
    expect(text).toContain("> Hello there!");
    expect(text).toContain("_[error] rate limited_");
  });

  it("marks image attachments and reasoning", () => {
    const chat = makeChat([
      { id: "m1", role: "user", content: "check this", done: true, image: "data:x;1" },
      { id: "m2", role: "assistant", content: "ok", done: true, reasoning: "thinking 1" },
    ]);
    const text = chatToWhatsAppText(chat);
    expect(text).toContain("> _[image attached]_");
    expect(text).toContain("> _[thought] thinking 1_");
  });

  it("escapes multi-line messages into separate quote lines", () => {
    const chat = makeChat([
      { id: "m1", role: "user", content: "line1\nline2", done: true },
    ]);
    const lines = chatToWhatsAppText(chat).split("\n");
    const quoted = lines.filter((l) => l.startsWith("> "));
    expect(quoted).toHaveLength(2);
  });
});

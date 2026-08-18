import { beforeEach, describe, expect, it, vi } from "vitest";
import { chatHtmlForPdf } from "../src/pdf";
import type { Chat, ChatMessage } from "../src/storage";

function mkMsg(overrides: Partial<ChatMessage>): ChatMessage {
  return { id: "m1", role: "user", content: "hello", done: true, ...overrides } as ChatMessage;
}

const chat: Chat = {
  id: "c1",
  title: "Test <chat>",
  messages: [
    mkMsg({ role: "user", content: "hello & <world>" }),
    mkMsg({ role: "assistant", content: "Hi **there**!\n\n- a\n- b", reasoning: "thought" }),
  ],
  folderId: null,
  pinned: false,
  createdAt: 1,
  updatedAt: 1,
} as Chat;

describe("chatHtmlForPdf", () => {
  it("includes title, date and all messages", () => {
    const html = chatHtmlForPdf(chat);
    expect(html).toContain("Test &lt;chat&gt;");
    expect(html).toContain("hello &amp; &lt;world&gt;");
    expect(html).toContain("Hi <strong>there</strong>!");
    expect(html).toContain("<li>a</li>");
    expect(html).toContain("Exported from Asky");
  });

  it("escapes HTML in user messages (no XSS)", () => {
    const evil: Chat = {
      ...chat,
      messages: [mkMsg({ role: "user", content: '<img src=x onerror="alert(1)">' })],
    };
    const html = chatHtmlForPdf(evil);
    // The img tag must be HTML-escaped so browsers render it as text, not execute it.
    expect(html).toContain("&lt;img src=x onerror=");
    expect(html).not.toContain("<img src=x");
  });
});

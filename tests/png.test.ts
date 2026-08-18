import { describe, expect, it, vi } from "vitest";
import { chatSvgForPng, messageSvgForPng } from "../src/png";
import type { Chat, ChatMessage } from "../src/storage";

const mkChat = (msgs: ChatMessage[]): Chat => ({
  id: "c1",
  title: "Test chat",
  folderId: null,
  pinned: false,
  messages: msgs,
  modelKey: "glow-1",
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

const userMsg: ChatMessage = {
  id: "m1",
  role: "user",
  content: "Hi bro, kaise ho?",
  createdAt: Date.now(),
};
const aiMsg: ChatMessage = {
  id: "m2",
  role: "assistant",
  content: "The **capital** of France is Paris.\n- item one\n- item two",
  done: true,
  createdAt: Date.now(),
};

describe("png export", () => {
  it("renders chat svg with dark theme", () => {
    const { svg, width, height } = chatSvgForPng(mkChat([userMsg, aiMsg]), true);
    expect(svg).toContain("<svg");
    expect(svg).toContain("font-weight:700");
    expect(svg).toContain("capital");
    expect(width).toBe(760);
    expect(height).toBeGreaterThan(100);
  });

  it("renders message svg with light theme", () => {
    const { svg, width } = messageSvgForPng(mkChat([aiMsg]), aiMsg, false);
    expect(svg).toContain("<svg");
    expect(svg).toContain("#ffffff");
    expect(width).toBe(760);
  });

  it("escapes xml special chars in title", () => {
    const chat = mkChat([]);
    chat.title = "Chat <b> & \"quoted\"";
    const { svg } = chatSvgForPng(chat, true);
    expect(svg).not.toContain("<b>");
    expect(svg).toContain("&amp;");
  });
});

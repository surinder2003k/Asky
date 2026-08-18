import { describe, expect, it } from "vitest";
import type { ChatMessage } from "../src/storage";

// Replicate cleanHistory logic from src/ai.ts for direct verification.
function cleanHistory(messages: ChatMessage[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const m of messages) {
    if (m.role === "assistant" && (!m.content || m.error)) continue;
    out.push(m);
  }
  return out;
}

function mk(role: ChatMessage["role"], content: string, opts: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: `${role}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    createdAt: Date.now(),
    ...opts,
  } as ChatMessage;
}

describe("cleanHistory", () => {
  it("strips failed empty assistants anywhere in history, not just at the end", () => {
    const msgs = [mk("user", "hi"), mk("assistant", "", { error: "429" })];
    expect(cleanHistory(msgs).map((m) => m.role)).toEqual(["user"]);
  });

  it("strips stacked failed assistants (429 then Mistral error)", () => {
    const msgs = [
      mk("user", "hi"),
      mk("assistant", "", { error: "429 Too Many Requests" }),
      mk("assistant", "", { error: "Expected last role User or Tool" }),
    ];
    const out = cleanHistory(msgs);
    expect(out.map((m) => m.role)).toEqual(["user"]);
    expect(out.every((m) => m.content !== "") ).toBe(true);
  });

  it("keeps valid assistant messages, including mid-history", () => {
    const msgs = [
      mk("user", "hi"),
      mk("assistant", "banana"),
      mk("assistant", "", { error: "429" }), // mid-history failed assistant
      mk("user", "again"),
      mk("assistant", "ok"),
    ];
    const out = cleanHistory(msgs);
    expect(out.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
    expect(out.some((m) => m.role === "assistant" && m.content === "banana")).toBe(true);
  });

  it("strips empty pending assistant even if not marked with an error", () => {
    const msgs = [mk("user", "hi"), mk("assistant", "")];
    expect(cleanHistory(msgs).map((m) => m.role)).toEqual(["user"]);
  });
});

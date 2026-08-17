import { describe, expect, it, vi, beforeEach } from "vitest";

// Verifies the OpenCode Zen reasoning fallback: models like mimo-v2.5-free emit
// the answer via delta.reasoning when delta.content is null/empty.

const sseReasoningOnly = [
  'data: {"choices":[{"delta":{"content":null,"reasoning":"Hello! "}}]}',
  'data: {"choices":[{"delta":{"content":null,"reasoning":"How can I help?"}}]}',
  "data: [DONE]",
].join("\n");

describe("opencode zen reasoning fallback (delta parsing)", () => {
  it("collects reasoning content when content chunks are null", () => {
    // Mirror of the chunk parsing in lib/ai.ts streamOpenAiCompatible
    let full = "";
    for (const line of sseReasoningOnly.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") break;
      const json = JSON.parse(data);
      let delta: unknown = json.choices?.[0]?.delta?.content;
      if ((typeof delta !== "string" || !delta) && true) {
        delta = json.choices?.[0]?.delta?.reasoning;
      }
      if (typeof delta === "string" && delta) full += delta;
    }
    expect(full).toBe("Hello! How can I help?");
  });

  it("prefers content over reasoning when content is present", () => {
    const sseBoth = [
      'data: {"choices":[{"delta":{"content":"Hi ","reasoning":"thinking..."}}]}',
      'data: {"choices":[{"delta":{"content":"there!"}}]}',
      "data: [DONE]",
    ].join("\n");
    let full = "";
    for (const line of sseBoth.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") break;
      const json = JSON.parse(data);
      let delta: unknown = json.choices?.[0]?.delta?.content;
      if ((typeof delta !== "string" || !delta) && true) {
        delta = json.choices?.[0]?.delta?.reasoning;
      }
      if (typeof delta === "string" && delta) full += delta;
    }
    expect(full).toBe("Hi there!");
  });
});

vi.mock("../lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/storage")>();
  return {
    ...actual,
    getApiKey: async (providerKey: string) =>
      providerKey === "opencode_zen" || providerKey === "mistral" ? "fake-user-key" : "",
  };
});

describe("streamChat end-to-end with mocked fetch", () => {

  it("falls back to reasoning chunks for opencode_zen mimo model", async () => {
    const makeSseStream = (parts: string[]) => {
      const encoded = new TextEncoder().encode(parts.join("\n") + "\n");
      let pos = 0;
      const reader = {
        read: async () => {
          if (pos >= encoded.length) return { done: true, value: undefined };
          const end = Math.min(pos + 64, encoded.length);
          const chunk = encoded.subarray(pos, end);
          pos = end;
          return { done: false, value: chunk };
        },
        releaseLock: () => undefined,
      } as unknown as ReadableStreamDefaultReader<Uint8Array>;
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        body: { getReader: () => reader },
        text: async () => parts.join("\n"),
      } as unknown as Response;
    };
    const fetchMock = vi.fn(async (input: unknown) => {
      const target = String(input);
      if (target.includes("opencode")) {
        return makeSseStream([
          'data: {"choices":[{"delta":{"content":null,"reasoning":"reasoning-answer"}}]}',
          "data: [DONE]",
        ]);
      }
      return makeSseStream(['data: {"choices":[{"delta":{"content":"normal"}}]}', "data: [DONE]"]);
    });
    vi.stubGlobal("fetch", fetchMock);

    const ai = await import("../lib/ai");
    const tokens: string[] = [];
    const ctrl = new AbortController();
    const text = await ai.streamChat({
      modelKey: "opencode_zen/mimo-v2.5-free",
      messages: [{ role: "user", text: "hi" }],
      onToken: (t: string) => tokens.push(t),
      signal: ctrl.signal,
    });
    expect(tokens.join("")).toBe("reasoning-answer");
    expect(text).toBe("reasoning-answer");
    vi.unstubAllGlobals();
  });

  it("falls back to reasoning_content field for opencode_zen (deepseek-v4-flash-free style)", async () => {
    const makeSseStream = (parts: string[]) => {
      const encoded = new TextEncoder().encode(parts.join("\n") + "\n");
      let pos = 0;
      const reader = {
        read: async () => {
          if (pos >= encoded.length) return { done: true, value: undefined };
          const end = Math.min(pos + 64, encoded.length);
          const chunk = encoded.subarray(pos, end);
          pos = end;
          return { done: false, value: chunk };
        },
        releaseLock: () => undefined,
      } as unknown as ReadableStreamDefaultReader<Uint8Array>;
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        body: { getReader: () => reader },
        text: async () => parts.join("\n"),
      } as unknown as Response;
    };
    const fetchMock = vi.fn(async (input: unknown) => {
      const target = String(input);
      if (target.includes("opencode")) {
        return makeSseStream([
          'data: {"choices":[{"delta":{"content":"","reasoning_content":"We need answer one"}}]}',
          'data: {"choices":[{"delta":{"content":"Understood.","reasoning_content":null}}]}',
          "data: [DONE]",
        ]);
      }
      return makeSseStream(['data: {"choices":[{"delta":{"content":"normal"}}]}', "data: [DONE]"]);
    });
    vi.stubGlobal("fetch", fetchMock);

    const ai = await import("../lib/ai");
    const tokens: string[] = [];
    const ctrl = new AbortController();
    const text = await ai.streamChat({
      modelKey: "opencode_zen/deepseek-v4-flash-free",
      messages: [{ role: "user", text: "hi" }],
      onToken: (t: string) => tokens.push(t),
      signal: ctrl.signal,
    });
    expect(tokens.join("")).toBe("We need answer oneUnderstood.");
    expect(text).toBe("We need answer oneUnderstood.");
    vi.unstubAllGlobals();
  });

  it("does NOT fall back to reasoning for non-opencode providers", async () => {
    const makeSseStream = (parts: string[]) => {
      const encoded = new TextEncoder().encode(parts.join("\n") + "\n");
      let pos = 0;
      const reader = {
        read: async () => {
          if (pos >= encoded.length) return { done: true, value: undefined };
          const end = Math.min(pos + 64, encoded.length);
          const chunk = encoded.subarray(pos, end);
          pos = end;
          return { done: false, value: chunk };
        },
        releaseLock: () => undefined,
      } as unknown as ReadableStreamDefaultReader<Uint8Array>;
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        body: { getReader: () => reader },
        text: async () => parts.join("\n"),
      } as unknown as Response;
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        makeSseStream(['data: {"choices":[{"delta":{"content":"normal","reasoning":"ignored"}}]}', "data: [DONE]"]),
      ),
    );

    const ai = await import("../lib/ai");
    const tokens: string[] = [];
    const ctrl = new AbortController();
    const text = await ai.streamChat({
      modelKey: "mistral/mistral-small-latest",
      messages: [{ role: "user", text: "hi" }],
      onToken: (t: string) => tokens.push(t),
      signal: ctrl.signal,
    });
    expect(tokens.join("")).toBe("normal");
    expect(text).toBe("normal");
    vi.unstubAllGlobals();
  });
});

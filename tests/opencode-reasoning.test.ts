import { describe, it, expect, vi, afterEach } from "vitest";
import { streamChat, type StreamCallbacks } from "../src/ai";

// Verifies the website's SSE parser (src/ai.ts streamChat) behavior:
// OpenCode Zen reasoning-heavy models (mimo-v2.5-free, deepseek-v4-flash-free)
// often send null/empty `content` and emit the answer via
// `delta.reasoning` / `delta.reasoning_content`, which the parser forwards
// through onReasoning while real content goes through onDelta.

function runStream(
  modelKey: string,
  cb: StreamCallbacks,
): Promise<void> {
  return new Promise((resolve) => {
    const wrap: StreamCallbacks = {
      ...cb,
      onDone: () => {
        cb.onDone();
        resolve();
      },
      onError: (m) => {
        cb.onError(m);
        resolve();
      },
    };
    const ctrl = new AbortController();
    streamChat("opencode", "fake-key", modelKey, [{ role: "user", content: "hi", id: "m1", createdAt: Date.now() }], ctrl, wrap);
  });
}

function makeSseResponse(parts: string[]): Response {
  const encoded = new TextEncoder().encode(parts.join("\n") + "\n");
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoded);
        controller.close();
      },
    }),
    { status: 200 },
  );
}

describe("SSE delta parsing (opencode reasoning fallback)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("emits content through onDelta", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        makeSseResponse([
          'data: {"choices":[{"delta":{"content":"Hello "}}]}',
          'data: {"choices":[{"delta":{"content":"world!"}}]}',
          "data: [DONE]",
        ]),
      ),
    );
    const deltas: string[] = [];
    const cb: StreamCallbacks = {
      onDelta: (t) => deltas.push(t),
      onDone: () => {},
      onError: () => {},
    };
    await runStream("opencode/mimo-v2.5-free", cb);
    expect(deltas.join("")).toBe("Hello world!");
  });

  it("emits reasoning when content is null (mimo-v2.5-free style)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        makeSseResponse([
          'data: {"choices":[{"delta":{"content":null,"reasoning":"thinking... "}}]}',
          'data: {"choices":[{"delta":{"content":null,"reasoning":"answer"}}]}',
          "data: [DONE]",
        ]),
      ),
    );
    const deltas: string[] = [];
    const reasoning: string[] = [];
    const cb: StreamCallbacks = {
      onDelta: (t) => deltas.push(t),
      onReasoning: (t) => reasoning.push(t),
      onDone: () => {},
      onError: () => {},
    };
    await runStream("opencode/mimo-v2.5-free", cb);
    expect(deltas).toHaveLength(0);
    expect(reasoning.join("")).toBe("thinking... answer");
  });

  it("emits reasoning_content for deepseek-v4-flash-free style chunks", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        makeSseResponse([
          'data: {"choices":[{"delta":{"content":"","reasoning_content":"We need answer one"}}]}',
          'data: {"choices":[{"delta":{"content":"Understood.","reasoning_content":null}}]}',
          "data: [DONE]",
        ]),
      ),
    );
    const deltas: string[] = [];
    const reasoning: string[] = [];
    const cb: StreamCallbacks = {
      onDelta: (t) => deltas.push(t),
      onReasoning: (t) => reasoning.push(t),
      onDone: () => {},
      onError: () => {},
    };
    await runStream("opencode/deepseek-v4-flash-free", cb);
    expect(deltas.join("")).toBe("Understood.");
    expect(reasoning.join("")).toBe("We need answer one");
  });

  it("reports unknown model via onError instead of throwing", async () => {
    const errors: string[] = [];
    const cb: StreamCallbacks = {
      onDelta: () => {},
      onDone: () => {},
      onError: (m) => errors.push(m),
    };
    await runStream("opencode/nonexistent-model", cb);
    expect(errors).toContain("Unknown model.");
  });
});


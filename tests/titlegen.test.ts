import { describe, expect, it, vi } from "vitest";
import { generateChatTitle, shouldAutoTitle } from "../src/titlegen";

describe("shouldAutoTitle", () => {
  it("allows auto-title only for untouched New Chat", () => {
    expect(shouldAutoTitle("New Chat")).toBe(true);
    expect(shouldAutoTitle("Renamed Chat")).toBe(false);
  });
});

describe("generateChatTitle", () => {
  it("returns null when provider base is missing", async () => {
    const result = await generateChatTitle(
      // @ts-expect-error intentional invalid provider
      "unknown-provider",
      "model",
      "key",
      [{ role: "user", content: "hi" }],
    );
    expect(result).toBeNull();
  });

  it("extracts a cleaned title from a mocked provider response", async () => {
    const fake = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: '"React Hooks Tips & Tricks"' } }] }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fake);
    const result = await generateChatTitle(
      "nvidia",
      "meta/llama-3.1-8b-instruct",
      "k",
      [{ role: "user", content: "give me react tips" }],
    );
    expect(result).toBe("React Hooks Tips & Tricks");
    const [url, opts] = fake.mock.calls[0];
    expect(url).toContain("integrate.api.nvidia.com/v1/chat/completions");
    expect((opts as RequestInit).headers).toMatchObject({ Authorization: "Bearer k" });
    vi.unstubAllGlobals();
  });

  it("returns null on non-ok responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("fail", { status: 500 })));
    const result = await generateChatTitle("groq", "llama3-8b-8192", "k", []);
    expect(result).toBeNull();
    vi.unstubAllGlobals();
  });

  it("caps titles longer than 8 words", async () => {
    const long = "One Two Three Four Five Six Seven Eight Nine Ten Eleven Twelve";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: long } }] }), { status: 200 })),
    );
    const result = await generateChatTitle("mistral", "open-mistral-7b", "k", []);
    expect(result?.split(" ").length).toBe(8);
    vi.unstubAllGlobals();
  });
});

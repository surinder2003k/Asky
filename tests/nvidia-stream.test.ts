import { describe, expect, it } from "vitest";

/**
 * Validates the NVIDIA API key (NVIDIA_API_KEY) against the live Nvidia
 * endpoint, mirroring how the site's own same-origin proxy relays requests.
 * A successful streaming chat completion proves the key works end-to-end.
 */
describe("Nvidia streaming E2E", () => {
  it("NVIDIA_API_KEY is set and completes a short streaming chat", async () => {
    const key = process.env.NVIDIA_API_KEY || "";
    expect(key.startsWith("nvapi-"), "key must start with nvapi-").toBe(true);

    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "z-ai/glm-5.2",
        messages: [{ role: "user", content: "Reply with only the word banana." }],
        stream: true,
        max_tokens: 50,
      }),
      signal: AbortSignal.timeout(300000),
    });

    // Nvidia free tiers return 429 when the account's daily quota is exhausted
    // (model-level, not key-level). Mirror the github-pat test: skip instead of
    // failing when the provider itself is rate-limited.
    if (res.status === 429) {
      console.log("Nvidia returned 429 (daily quota exhausted); skipping stream check");
      return;
    }

    expect(res.ok, `HTTP ${res.status}`).toBe(true);
    const text = await res.text();
    expect(text.length).toBeGreaterThan(10);
    const all = text.split("\n\n");
    const deltas = all
      .map((part) => part.replace(/^data: /, ""))
      .filter((l) => l && l !== "[DONE]")
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean) as Array<{ choices?: Array<{ delta?: { content?: string } }> }>;
    const content = deltas.map((d) => d.choices?.[0]?.delta?.content || "").join("");
    expect(content.length).toBeGreaterThan(0);
  }, 150000);
});

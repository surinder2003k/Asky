import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

// Policy: the app must NOT ship with any embedded API keys.
// Users add their own keys via the in-app Settings screen, stored locally (AsyncStorage).
describe("no embedded API keys", () => {
  it("app code does not contain embedded provider key prefixes", () => {
    const src = readFileSync(resolve(__dirname, "../lib/ai.ts"), "utf8");
    expect(src).not.toContain("nvapi-");
    expect(src).not.toContain("sk-or-v1");
    expect(src).not.toContain("gsk_");
    expect(src).not.toContain("csk-");
    expect(src).not.toContain("AQ.");
  });

  it("getApiKey returns empty string when no key is set", async () => {
    const { getApiKey } = await import("../lib/storage");
    const key = await getApiKey("mistral");
    expect(key).toBe("");
  });
});

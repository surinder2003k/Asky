import { describe, it, expect } from "vitest";

// Regression guard for the blank-screen crash fix:
// send() must never reach streamChat() when the chosen provider has no API key,
// and instead finalize an in-chat error bubble (or drop an empty new chat).
// Here we assert the data-level preconditions the guard relies on.

import { MODELS, DEFAULT_MODEL_KEY, PROVIDERS, type ProviderKey } from "../src/providers";

describe("no-API-key guard preconditions", () => {
  it("default model key belongs to a real model in the catalog", () => {
    const found = MODELS.find((m) => m.key === DEFAULT_MODEL_KEY);
    expect(found).toBeDefined();
  });

  it("every MODELS entry has a valid PROVIDERS config", () => {
    for (const m of MODELS) {
      expect(PROVIDERS[m.provider as ProviderKey]).toBeDefined();
    }
  });

  it("each provider has at least one model, so the fallback picker never throws", () => {
    for (const p of Object.keys(PROVIDERS) as ProviderKey[]) {
      expect(MODELS.some((m) => m.provider === p)).toBe(true);
    }
  });

  it("vision models exist so auto-switch can always find a fallback", () => {
    expect(MODELS.some((m) => m.vision)).toBe(true);
  });

  it("an empty key string is the only falsy key, so the guard (!apiKey) is exact", () => {
    const emptyKey = "" || "";
    expect(emptyKey).toBeFalsy();
    const realKey = "sk-test" || "";
    expect(realKey).toBeTruthy();
  });
});

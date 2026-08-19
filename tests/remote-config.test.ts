import { describe, it, expect } from "vitest";
import { MODELS, getModel, DEFAULT_MODEL_KEY } from "../src/providers";

// OTA remote config was removed in Batch 47 — the model catalog is now fully
// static in src/providers.ts. This test validates that curated catalog instead.
describe("static model catalog (providers.ts)", () => {
  it("has free-tier-only models, no dead Cerebras entries", () => {
    expect(Array.isArray(MODELS)).toBe(true);
    expect(MODELS.length).toBeGreaterThan(0);
    const keys = MODELS.map((m) => m.key);
    expect(keys.filter((k) => k.startsWith("cerebras/"))).toHaveLength(0);
    // Verified-working models must remain present.
    expect(keys).toContain("z-ai/glm-5.2");
    expect(keys).toContain("mistral/mistral-small-latest");
    expect(keys).toContain("opencode/mimo-v2.5-free");
    expect(getModel(DEFAULT_MODEL_KEY)).toBeTruthy();
  });
});

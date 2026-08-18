import { describe, it, expect } from "vitest";
import { MODELS, PROVIDERS, resolveModelId } from "../src/providers";

describe("open-source: no built-in keys", () => {
  it("no provider has a built-in key", () => {
    for (const p of Object.values(PROVIDERS)) {
      expect(p.hasBuiltInKey).toBeFalsy();
      expect(p.envKey).toBe("");
    }
  });

  it("models resolve to valid ids (bareId providers strip their prefix)", () => {
    for (const m of MODELS) {
      const id = resolveModelId(m);
      expect(id.length).toBeGreaterThan(0);
      if (m.keepPrefix) {
        expect(id).toBe(m.key); // nvidia catalog models keep full id
      } else if (PROVIDERS[m.provider].bareId) {
        // bareId providers must not send their provider prefix
        expect(id).not.toMatch(new RegExp(`^${PROVIDERS[m.provider].modelPrefix.replace("/", "\\/")}`));
      } else {
        expect(id).toBe(m.key); // nvidia vendor/model ids
      }
    }
  });
});

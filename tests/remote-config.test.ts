import { describe, it, expect } from "vitest";
import axios from "axios";

const CONFIG_URL =
  "https://files.manuscdn.com/user_upload_by_module/session_file/310519663665550846/DjDfnnbDgFgYVAAk.json";

describe("hosted remote config (OTA model list)", () => {
  it("serves the updated model list without dead Cerebras/Gemini models", async () => {
    const res = await axios.get(CONFIG_URL, { timeout: 15000 });
    expect(res.status).toBe(200);
    const d = res.data;
    expect(d.version).toBe("2026-08-16b");
    expect(Array.isArray(d.models)).toBe(true);
    const ids = d.models.map((m: any) => m.id);
    // The user's Gemini project is 403-banned and Cerebras free tier is 402/quota-exhausted,
    // so neither provider's models should appear in the curated hosted list.
    expect(ids.filter((i: string) => i.startsWith("cerebras/"))).toHaveLength(0);
    expect(ids.filter((i: string) => i.startsWith("gemini/"))).toHaveLength(0);
    // Verified-working models must remain present.
    expect(ids).toContain("nvidia/z-ai/glm-5.2");
    expect(ids).toContain("mistral/mistral-small-latest");
    expect(ids).toContain("opencode_zen/mimo-v2.5-free");
    expect(d.defaultModelKey).toBe("mistral/mistral-small-latest");
    expect(typeof d.providerBases.nvidia).toBe("string");
  }, 20000);
});

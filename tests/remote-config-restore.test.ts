import { describe, expect, it } from "vitest";

/**
 * Validates that the REMOTE_CONFIG_URL secret points at a valid,
 * reachable remote config JSON (original production version).
 */
describe("remote config restore", () => {
  it("original config JSON is reachable and valid", async () => {
    const url = process.env.REMOTE_CONFIG_URL;
    expect(url).toBeTruthy();
    const res = await fetch(url!, { headers: { "Cache-Control": "no-cache" } });
    expect(res.status).toBe(200);
    const config = await res.json();
    expect(config).toMatchObject({
      version: "2026-08-16b",
    });
    // Regenerated 2026-08-16: dead Nvidia DeepSeek V4 Flash removed, Nvidia
    // model IDs corrected (was "nvidia/nvidia/..." which caused 404s), and
    // all dead Cerebras (402 quota) / Gemini (403 denied) models removed.
    const models: unknown[] = config.models ?? config.profiles ?? [];
    expect(models.length).toBe(40);
    expect(config.models.find((m: { id: string }) => m.id === "nvidia/z-ai/glm-5.2")).toBeTruthy();
    expect(config.models.filter((m: { id: string }) => m.id.startsWith("cerebras/") || m.id.startsWith("gemini/")).length).toBe(0);
  });
});

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
      version: "2026-08-12",
    });
    // The restored baseline is exactly 37 models (the demo pushed a 38th on a
    // separate test URL, which is why version "2026-08-12-test" exists there).
    const models: unknown[] = config.models ?? config.profiles ?? [];
    expect(models.length).toBe(37);
  });
});

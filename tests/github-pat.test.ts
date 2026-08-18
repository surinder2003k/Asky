import { describe, expect, it } from "vitest";

const pat = process.env.GITHUB_PAT || "";

describe("GitHub PAT validation", () => {
  it("GITHUB_PAT is non-empty and can read the Asky repo via REST API", async () => {
    if (!pat) {
      console.log("GITHUB_PAT not set; skipping credential check");
      return;
    }
    expect(pat.length).toBeGreaterThan(20);
    const res = await fetch("https://api.github.com/repos/surinder2003k/Asky", {
      headers: { Authorization: `Bearer ${pat}`, "User-Agent": "asky-sync" },
    });
    expect(res.status, `HTTP ${res.status}`).toBe(200);
    const data = (await res.json()) as { full_name?: string };
    expect(data.full_name).toBe("surinder2003k/Asky");
  }, 30000);
});

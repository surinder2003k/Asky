import { describe, expect, it } from "vitest";
import { followUpSuggestions, homeSuggestions } from "../src/suggestions";
import { genId } from "../src/storage";

describe("followUpSuggestions", () => {
  it("returns exactly 4 prompts", () => {
    expect(followUpSuggestions("Any reply here about anything.")).toHaveLength(4);
  });

  it("matches code topics when keywords present", () => {
    const prompts = followUpSuggestions("Here is the JavaScript function you asked for.");
    expect(prompts.join(" ").toLowerCase()).toContain("simpler");
  });

  it("matches resume topics", () => {
    const prompts = followUpSuggestions("Here is your resume draft with career details.");
    expect(prompts.join(" ").toLowerCase()).toContain("skills");
  });

  it("falls back to keyword-based prompts for unknown topics", () => {
    const prompts = followUpSuggestions("Bananas grow well in tropical climates with warm soil.");
    expect(prompts[0]).toContain("tropical");
    expect(prompts).toHaveLength(4);
  });

  it("uses generic prompts for very short input", () => {
    const prompts = followUpSuggestions("Ok.");
    expect(prompts).toHaveLength(4);
  });

  it("is deterministic", () => {
    const a = followUpSuggestions("The same reply text twice");
    const b = followUpSuggestions("The same reply text twice");
    expect(a).toEqual(b);
  });
});

describe("homeSuggestions", () => {
  it("returns 4 suggestions for empty history (static fallback)", () => {
    expect(homeSuggestions([])).toHaveLength(4);
  });

  it("derives suggestions from recent chats with user messages", () => {
    const chats = [
      {
        id: genId(),
        title: "C1",
        messages: [{ id: genId(), role: "user", content: "plan a trip to Japan", done: true } as never],
        folderId: null,
        pinned: false,
        createdAt: Date.now() - 1000,
        updatedAt: Date.now() - 1000,
      },
    ] as never;
    const s = homeSuggestions(chats);
    expect(s[0].text).toContain("plan a trip to Japan");
  });

  it("fills remaining slots with static suggestions without duplicates", () => {
    const chats = [
      {
        id: genId(),
        title: "C1",
        messages: [{ id: genId(), role: "user", content: "foo", done: true } as never],
        folderId: null,
        pinned: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ] as never;
    const s = homeSuggestions(chats);
    expect(s).toHaveLength(4);
    expect(new Set(s.map((x) => x.text)).size).toBe(4);
  });
});

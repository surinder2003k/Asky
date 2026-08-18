import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  recordModelStatus,
  getModelStatus,
  isRateLimitError,
  RECOVERY_MINUTES,
} from "../src/modelStatus";

const KEY = "opencode/mimo-v2.5-free";

// Vitest runs in node (no DOM) — shim a memory-backed Storage for the module.
function makeStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    get length() {
      return store.size;
    },
    key: (i) => [...store.keys()][i] ?? null,
  };
}

let storage: Storage;
beforeEach(() => {
  storage = makeStorage();
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
  });
});

describe("modelStatus tracker", () => {
  it("starts unknown", () => {
    expect(getModelStatus(KEY)).toBe("unknown");
  });

  it("records ok and rate-limited", () => {
    recordModelStatus(KEY, "rate-limited");
    expect(getModelStatus(KEY)).toBe("rate-limited");
    recordModelStatus(KEY, "ok");
    expect(getModelStatus(KEY)).toBe("ok");
  });

  it("recovers stale rate-limited entries to unknown", () => {
    vi.setSystemTime(new Date("2026-08-18T10:00:00Z"));
    recordModelStatus(KEY, "rate-limited");
    expect(getModelStatus(KEY)).toBe("rate-limited");
    vi.setSystemTime(new Date("2026-08-18T11:00:01Z").getTime());
    expect(getModelStatus(KEY)).toBe("unknown");
    vi.useRealTimers();
  });

  it("classifies rate-limit error messages", () => {
    expect(isRateLimitError("this model hit its daily free limit")).toBe(true);
    expect(isRateLimitError("429 Too Many Requests")).toBe(true);
    expect(isRateLimitError("Free usage limit reached")).toBe(true);
    expect(isRateLimitError("Key works")).toBe(false);
    expect(isRateLimitError("Check your internet connection")).toBe(false);
  });

  it("persists across fresh reads", () => {
    recordModelStatus(KEY, "ok");
    localStorage.removeItem("asky:model-status:v1");
    expect(getModelStatus(KEY)).toBe("unknown");
  });

  it("covers RECOVERY_MINUTES is 60", () => {
    expect(RECOVERY_MINUTES).toBe(60);
  });
});

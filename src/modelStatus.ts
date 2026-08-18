/**
 * Live model availability tracker.
 *
 * Providers like OpenCode Zen do not expose per-user usage/rate-limit
 * headers or an usage API, so the exact remaining quota is unknowable.
 * Instead we observe outcomes: when a model reply fails with a
 * rate-limit-like error we mark it "rate-limited"; when it succeeds we
 * mark it "ok". Unknown models have never been used in this device.
 *
 * Status auto-recovers to "unknown" after RECOVERY_MINUTES so a model
 * whose limit has (likely) reset can be retried.
 */

export type ModelStatusKind = "ok" | "rate-limited" | "unknown";

export interface ModelStatusEntry {
  kind: ModelStatusKind;
  /** ms epoch when this status was last set */
  at: number;
}

const STORAGE_KEY = "asky:model-status:v1";
export const RECOVERY_MINUTES = 60;

function load(): Record<string, ModelStatusEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function save(map: Record<string, ModelStatusEntry>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* storage full/unavailable — tracking is best-effort */
  }
}

export function recordModelStatus(modelKey: string, kind: ModelStatusKind): void {
  const map = load();
  map[modelKey] = { kind, at: Date.now() };
  save(map);
}

/**
 * Get the live status of a model, recovering "rate-limited" entries to
 * "unknown" after the recovery window so stale hits stop blocking.
 */
export function getModelStatus(modelKey: string): ModelStatusKind {
  const map = load();
  const entry = map[modelKey];
  if (!entry) return "unknown";
  const ageMin = (Date.now() - entry.at) / 60000;
  if (ageMin >= RECOVERY_MINUTES) {
    // Stale — clear and report unknown so the picker treats it as untested.
    const fresh = { ...map };
    delete fresh[modelKey];
    save(fresh);
    return "unknown";
  }
  return entry.kind;
}

/** All statuses for the picker UI (reactive-friendly snapshot). */
export function getAllStatuses(): Record<string, ModelStatusKind> {
  const map = load();
  const out: Record<string, ModelStatusKind> = {};
  for (const key of Object.keys(map)) out[key] = getModelStatus(key);
  return out;
}

/** Rate-limit-like error message classifier. */
export function isRateLimitError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("rate limit") ||
    m.includes("daily free limit") ||
    m.includes("usage limit") ||
    m.includes("too many requests") ||
    m.includes("free usage limit") ||
    m.includes("429") ||
    m.includes("quota")
  );
}

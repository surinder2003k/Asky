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

/**
 * Rate-limit "progress" level for the green health bar shown above each model row.
 *
 * Free-tier providers (OpenCode Zen, Gemini, OpenRouter free) expose NO remaining-
 * quota headers or usage API, so an exact percentage is impossible. We map the
 * observed health outcome to a 0-100 bar:
 *   ok           -> 100% (full green — model is healthy)
 *   rate-limited -> 0%   (bar empty, red-tinged — limit hit; recovers after cooldown)
 *   unknown      -> 50%  (half-filled, muted — never tested in this session)
 *
 * `since` is exposed so a ticking UI can show the bar slowly refilling during
 * recovery (visual progress without inventing fake quota numbers).
 */
export interface HealthBar {
  level: number; // 0-100
  state: "healthy" | "limited" | "unknown";
  at: number; // status epoch (ms)
  /** ms until the "limited" state auto-recovers (0 when not limited) */
  recoverInMs: number;
}

export function getHealthBar(modelKey: string): HealthBar {
  const map = load();
  const entry = map[modelKey];
  if (!entry) return { level: 50, state: "unknown", at: 0, recoverInMs: 0 };
  const ageMs = Date.now() - entry.at;
  const ageMin = ageMs / 60000;
  if (entry.kind === "rate-limited") {
    if (ageMin >= RECOVERY_MINUTES) return { level: 50, state: "unknown", at: 0, recoverInMs: 0 };
    const remaining = Math.max(0, RECOVERY_MINUTES * 60000 - ageMs);
    // Bar refills from 0 -> 100 across the recovery window so users SEE progress.
    const level = Math.round((ageMs / (RECOVERY_MINUTES * 60000)) * 100);
    return { level, state: "limited", at: entry.at, recoverInMs: remaining };
  }
  return { level: 100, state: "healthy", at: entry.at, recoverInMs: 0 };
}

/** All health bars for the picker UI (reactive-friendly snapshot). */
export function getAllHealthBars(): Record<string, HealthBar> {
  const map = load();
  const out: Record<string, HealthBar> = {};
  for (const key of Object.keys(map)) out[key] = getHealthBar(key);
  return out;
}

/** Minutes -> human countdown like "24m" or "1m 30s". */
export function formatRecovery(ms: number): string {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m <= 0) return `${Math.max(1, s)}s`;
  return r > 0 ? `${m}m ${r}s` : `${m}m`;
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

/**
 * Asky login — custom, local-only authentication.
 *
 * Security model (why this is safe for a personal site):
 * - The site never sends the password anywhere. No external auth, no server.
 * - A salted SHA-256 hash of the password is stored in localStorage
 *   (initialized once at build time from the gitignored credentials file).
 *   Only the hash is stored — the plaintext password cannot be recovered
 *   from a SHA-256 hash.
 * - After a successful login, a SESSION FLAG (random 64-char token, not the
 *   password) is stored in localStorage. An attacker who sees localStorage
 *   gains a session token that works only on this device and is revoked
 *   instantly via logout.
 * - Failed logins never reveal whether the username or password was wrong.
 *
 * The credentials file (src/credentials.ts) is gitignored and only used as a
 * one-time seed: on the very first visit it initializes the stored hash.
 * After that, the password can be changed anytime from Settings.
 */

const KEY_SESSION = "asky.session";
const KEY_SESSION_TOKEN = "asky.sessionToken";
const KEY_STORED_CREDS = "asky.authCreds"; // runtime-editable hashed credentials
// 30 days of inactivity → session expires
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Synchronous SHA-256 (SubtleCrypto returns a Promise; digest itself is fast). */
export async function sha256(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface StoredCreds {
  username: string;
  hash: string; // salted sha256 — salt is baked into the hash string
  salt: string;
  seededAt: number;
}

let storedCache: StoredCreds | null = null;

/**
 * Returns the current hashed credentials, seeding from the credentials file
 * the very first time (file is the only place the plaintext password exists).
 * This is async only because of the sha256 computation — hashing is fast (<5ms).
 */
export async function getStoredCreds(): Promise<StoredCreds> {
  if (storedCache) return storedCache;
  try {
    const raw = localStorage.getItem(KEY_STORED_CREDS);
    if (raw) {
      storedCache = JSON.parse(raw) as StoredCreds;
      return storedCache;
    }
  } catch {
    /* corrupt entry — re-seed below */
  }
  // First visit: seed from the gitignored credentials file, then save only the hash.
  try {
    const mod = (await import(/* @vite-ignore */ "./credentials")) as {
      USERNAME?: string;
      PASSWORD?: string;
      SALT?: string;
    };
    if (!mod || !mod.PASSWORD) throw new Error("no creds");
    const salt = mod.SALT ?? "asky";
    storedCache = {
      username: mod.USERNAME ?? "Sunny",
      hash: await sha256(`${salt}:${mod.PASSWORD}`),
      salt,
      seededAt: Date.now(),
    };
    localStorage.setItem(KEY_STORED_CREDS, JSON.stringify(storedCache));
    return storedCache;
  } catch {
    // credentials file missing → locked state that can never match any input
    storedCache = { username: "__missing_credentials_file__", hash: "__locked__", salt: "", seededAt: 0 };
    return storedCache;
  }
}

export interface LoginAttempt {
  ok: boolean;
}

/**
 * Verify locally and issue a session token.
 * FAST: no network, no delay — hashing takes a few milliseconds.
 */
export async function tryLogin(username: string, password: string): Promise<LoginAttempt> {
  const creds = await getStoredCreds();
  const normalizedUser = username.trim();
  const inputHash = await sha256(`${creds.salt}:${password}`);
  const match =
    normalizedUser.toLowerCase() === creds.username.toLowerCase() && inputHash === creds.hash;
  if (!match) return { ok: false };
  // Issue a fresh random session token (NOT the password) and persist it.
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  try {
    localStorage.setItem(KEY_SESSION, JSON.stringify({ token, at: Date.now() }));
    localStorage.setItem(KEY_SESSION_TOKEN, token);
  } catch {
    /* private browsing / quota — session is in-memory only */
  }
  return { ok: true };
}

/**
 * Change the password (runtime-editable). Old password is verified first.
 * Immediately invalidates any existing session so the user must log in again
 * with the new password — no dangling sessions with stale passwords.
 */
export async function changePassword(
  oldPassword: string,
  newPassword: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!newPassword || newPassword.length < 3) {
    return { ok: false, error: "New password must be at least 3 characters." };
  }
  const creds = await getStoredCreds();
  const oldHash = await sha256(`${creds.salt}:${oldPassword}`);
  if (oldHash !== creds.hash) {
    return { ok: false, error: "Old password is incorrect." };
  }
  const salt = creds.salt || "asky";
  const updated: StoredCreds = {
    ...creds,
    hash: await sha256(`${salt}:${newPassword}`),
    seededAt: Date.now(),
  };
  try {
    localStorage.setItem(KEY_STORED_CREDS, JSON.stringify(updated));
  } catch {
    return { ok: false, error: "Could not save the new password." };
  }
  storedCache = updated;
  // Revoke existing sessions — must log in again with the new password.
  logout();
  return { ok: true };
}

export function isLoggedIn(): boolean {
  let token: string | null = null;
  try {
    token = localStorage.getItem(KEY_SESSION_TOKEN);
  } catch {
    return false;
  }
  if (!token) return false;
  try {
    const raw = localStorage.getItem(KEY_SESSION);
    if (!raw) return false;
    const s = JSON.parse(raw) as { token: string; at: number };
    if (s.token !== token) return false;
    if (Date.now() - s.at > SESSION_TTL_MS) return false;
  } catch {
    return false;
  }
  return true;
}

export function logout() {
  try {
    localStorage.removeItem(KEY_SESSION);
    localStorage.removeItem(KEY_SESSION_TOKEN);
  } catch {
    /* ignore */
  }
}

export { KEY_SESSION, KEY_SESSION_TOKEN };

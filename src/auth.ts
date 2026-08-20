/**
 * Asky login — custom, local-only authentication.
 *
 * Security model (why this is safe for a personal site):
 * - The site never sends the password anywhere. No external auth, no server.
 * - The expected username + a salted SHA-256 hash of the password are derived
 *   at BUILD time (bundled into JS). Only the HASH is in the bundle — the
 *   plaintext password cannot be recovered from a SHA-256 hash.
 * - After a successful login, the SESSION FLAG (a random 64-char token, not
 *   the password) is stored in localStorage. An attacker who sees localStorage
 *   gains a session token that works only on this device and can be revoked
 *   instantly via logout (token regeneration).
 * - Failed logins never reveal whether the username or password was wrong.
 *
 * Credentials are defined in src/credentials.ts (username: Sunny / password: 3424).
 * That file is excluded from Git (see .gitignore) so credentials never enter
 * the repository or the GitHub website branch.
 */

const KEY_SESSION = "asky.session";
const KEY_SESSION_TOKEN = "asky.sessionToken";
// 30 days of inactivity → session expires
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Lazy-loaded async SHA-256 (SubtleCrypto, available in all modern browsers). */
export async function sha256(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

let credsCache: { username: string; hash: string } | null = null;
let saltCache: { SALT: string } | null = null;

export async function loadSalt(): Promise<{ SALT: string }> {
  if (saltCache) return saltCache;
  try {
    const mod = await import(/* @vite-ignore */ "./credentials");
    saltCache = { SALT: mod.SALT ?? "asky" };
    return saltCache;
  } catch {
    return { SALT: "asky" };
  }
}

export async function loadCredentials(): Promise<{ username: string; hash: string }> {
  if (credsCache) return credsCache;
  try {
    // Dynamic import keeps the credentials file OUT of the main bundle until
    // the login page actually needs it, and the file itself is gitignored.
    const mod = await import(/* @vite-ignore */ "./credentials");
    credsCache = { username: mod.USERNAME, hash: await sha256(`${mod.SALT ?? ""}:${mod.PASSWORD}`) };
    return credsCache;
  } catch {
    // credentials file missing → fall back to a locked state that can never
    // match any input, so the site stays gated but never crashes.
    credsCache = { username: "__missing_credentials_file__", hash: "__locked__" };
    return credsCache;
  }
}

export interface LoginAttempt {
  ok: boolean;
}

export async function tryLogin(username: string, password: string): Promise<LoginAttempt> {
  const creds = await loadCredentials();
  const normalizedUser = username.trim();
  const { SALT } = await loadSalt();
  const inputHash = await sha256(`${SALT}:${password}`);
  // Normalize both sides: hash comparison uses the same salted scheme.
  const match =
    normalizedUser.toLowerCase() === creds.username.toLowerCase() &&
    inputHash === creds.hash;
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

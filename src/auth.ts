/**
 * Authentication disabled as per user request.
 * Direct access to chat interface is enabled.
 */

export async function sha256(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isLoggedIn(): boolean {
  return true; // Always logged in
}

export function logout() {
  // No-op
}

export async function tryLogin(): Promise<{ ok: boolean }> {
  return { ok: true };
}

export async function changePassword(): Promise<{ ok: boolean }> {
  return { ok: true };
}

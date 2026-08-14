/**
 * Built-in default API keys (hidden in the background).
 * The app works out-of-the-box without the user adding any key.
 * If the user sets their own key for a provider in Settings, that key is used instead.
 */
export const BUILTIN_KEYS: Record<string, string> = {
  nvidia: "", // Add your own Nvidia NIM API key here
};

/**
 * Resolve the effective API key for a provider:
 * user's saved key wins; otherwise fall back to the built-in default (if any).
 */
export async function resolveApiKey(providerKey: string): Promise<string> {
  const { getApiKey } = await import("./storage");
  const userKey = await getApiKey(providerKey);
  if (userKey && userKey.trim().length > 0) return userKey.trim();
  return BUILTIN_KEYS[providerKey] ?? "";
}

/** True when the provider has a usable key (user-provided or built-in). */
export async function hasUsableKey(providerKey: string): Promise<boolean> {
  const key = await resolveApiKey(providerKey);
  return key.trim().length > 0;
}

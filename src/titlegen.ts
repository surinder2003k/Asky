/**
 * Auto chat title generation.
 *
 * After the first assistant reply finishes, the client asks the AI (using the
 * chat's own model + key) for a very short title (max ~6 words) for the chat,
 * and applies it unless the user already renamed the chat ("New Chat" is
 * considered untouched). A network/key failure degrades gracefully: the chat
 * keeps whatever title it had.
 */

import { PROVIDERS, type ProviderKey } from "./providers";

function providerBase(pk: ProviderKey): string {
  return PROVIDERS[pk]?.url || "";
}

export async function generateChatTitle(
  providerKey: ProviderKey,
  model: string,
  apiKey: string | undefined,
  messages: { role: string; content: string }[],
  signal?: AbortSignal,
): Promise<string | null> {
  const base = providerBase(providerKey);
  if (!base) return null;

  const payload = {
    model,
    max_tokens: 32,
    stream: false,
    messages: [
      {
        role: "system",
        content:
          "Give a short chat title (max 6 words, no quotes, no punctuation). Write it in the same language the user wrote their messages in. Nothing else.",
      },
      ...messages.slice(-8),
    ],
  };

  const key = apiKey?.trim();
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = data?.choices?.[0]?.message?.content?.trim();
  if (!raw) return null;
  // Keep only the first line and cap length.
  let title = raw.split(/\r?\n/)[0].replace(/['"`.]/g, "").trim();
  const words = title.split(/\s+/);
  if (words.length > 8) title = words.slice(0, 8).join(" ");
  return title || null;
}

/** Pick the title that the user would expect: untouched "New Chat" becomes the AI title. */
export function shouldAutoTitle(currentTitle: string): boolean {
  return currentTitle === "New Chat";
}

/**
 * Web search support for Asky.
 *
 * Two-stage approach (no tool-calling needed, works with plain chat models):
 * 1. When "Web search" is enabled, the user's question is searched first via
 *    the server-side /api/web-search endpoint (server scrapes DuckDuckGo —
 *    no CORS issue, no API key needed).
 * 2. The top results are appended to the user's message as search context
 *    and the chat model answers using them.
 *
 * Results are shown inline in the chat as a small "Web results" card so the
 * user can see where the answer came from.
 */
export interface WebResult {
  title: string;
  url: string;
  snippet: string;
}

export async function webSearch(query: string): Promise<WebResult[]> {
  const res = await fetch("/api/web-search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Search failed (${res.status}): ${t}`);
  }
  const j = await res.json();
  const items: WebResult[] = Array.isArray(j?.results) ? j.results : [];
  return items.slice(0, 5).filter((r) => r && r.title && r.url);
}

/** Prefix injected before the user message when search results are included. */
export const SEARCH_CONTEXT_PREFIX =
  "I searched the web and here are the top results. Use them to answer accurately (cite the most relevant source URLs):\n";

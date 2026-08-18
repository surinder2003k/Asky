import type { ChatMessage } from "./storage";

export interface ChatSearchHit {
  msgId: string;
  /** zero-based start index of the match within the plain text */
  start: number;
  /** matched length */
  len: number;
  /** plain-text snippet around the match for the toolbar preview */
  snippet: string;
}

const SNIP = 60;

/**
 * Case-insensitive search across the visible text of chat messages,
 * skipping fenced code blocks (search inside code is too noisy).
 */
export function searchInChat(query: string, messages: ChatMessage[]): ChatSearchHit[] {
  const q = query.toLowerCase().trim();
  if (!q || !messages.length) return [];
  const hits: ChatSearchHit[] = [];

  for (const m of messages) {
    if (!m.content) continue;
    const plain = stripFenced(m.content).toLowerCase();
    let idx = 0;
    while ((idx = plain.indexOf(q, idx)) !== -1) {
      const from = Math.max(0, idx - SNIP);
      const to = Math.min(plain.length, idx + q.length + SNIP);
      const snippet =
        (from > 0 ? "…" : "") +
        plain.slice(from, to) +
        (to < plain.length ? "…" : "");
      hits.push({ msgId: m.id, start: idx, len: q.length, snippet });
      idx += q.length;
    }
  }
  return hits;
}

function stripFenced(text: string): string {
  return text.replace(/```[\s\S]*?```/g, " ").replace(/`[^`\n]+`/g, " ");
}

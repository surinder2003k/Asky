import type { Chat, ChatMessage } from "./storage";

// ---------------------------------------------------------------------------
// Follow-up suggestion chips (generated client-side from the assistant reply)
// ---------------------------------------------------------------------------

const TOPIC_TEMPLATES: Array<{ pattern: RegExp; prompts: string[] }> = [
  {
    pattern: /\b(code|coding|html|css|javascript|typescript|react|python|function|api|debug|bug|program|algorithm)\b/i,
    prompts: [
      "Explain how this works step by step",
      "Show a simpler version of this",
      "What are the common mistakes with this?",
      "How can I improve or optimize it?",
    ],
  },
  {
    pattern: /\b(resume|cv|job|interview|career|skill)\b/i,
    prompts: [
      "Make it more professional",
      "Add a skills section",
      "Tailor it for a specific role",
      "Give me an interview prep checklist",
    ],
  },
  {
    pattern: /\b(story|write|essay|poem|creative|novel)\b/i,
    prompts: [
      "Continue the story",
      "Give it a twist ending",
      "Describe the main character in detail",
      "Turn it into a script",
    ],
  },
  {
    pattern: /\b(recipe|cook|food|meal|ingredient|bake)\b/i,
    prompts: [
      "Give me the full recipe with measurements",
      "Suggest healthier alternatives",
      "What can I substitute?",
      "Plan a weekly meal menu around this",
    ],
  },
  {
    pattern: /\b(travel|trip|country|city|hotel|flight|visit|tour)\b/i,
    prompts: [
      "Make a day-by-day itinerary",
      "What should I budget for?",
      "Suggest hidden gems there",
      "What documents do I need?",
    ],
  },
  {
    pattern: /\b(health|exercise|fitness|workout|sleep|diet|weight)\b/i,
    prompts: [
      "Give me a weekly plan",
      "Is this safe for beginners?",
      "What results should I expect?",
      "Track my progress — what should I log?",
    ],
  },
];

const GENERIC_PROMPTS = [
  "Tell me more about this",
  "Give me a summary of the key points",
  "What should I do next?",
  "Any related tips?",
];

/**
 * Generate 4 follow-up suggestion prompts from an assistant reply.
 * Pure function — deterministic for the same input.
 */
export function followUpSuggestions(text: string): string[] {
  const t = text.toLowerCase();
  const words = t.split(/[^a-z0-9]+/).filter((w) => w.length > 3);
  for (const tpl of TOPIC_TEMPLATES) {
    if (tpl.pattern.test(t)) return tpl.prompts.slice(0, 4);
  }
  if (words.length >= 2) {
    // generic topic-aware prompts mentioning a keyword from the reply
    const kw = words.sort((a, b) => b.length - a.length)[0];
    return [
      `Explain "${kw}" in more detail`,
      `What are the main points about "${kw}"?`,
      `Give examples related to "${kw}"`,
      GENERIC_PROMPTS[0],
    ];
  }
  return GENERIC_PROMPTS;
}

// ---------------------------------------------------------------------------
// History-aware home suggestions
// ---------------------------------------------------------------------------

const STATIC_SUGGESTIONS = [
  { icon: "📝", text: "Help me write a professional resume from my details" },
  { icon: "🌐", text: "What are the latest AI trends this year?" },
  { icon: "📅", text: "Plan a productive morning routine for me" },
  { icon: "🎨", text: "Write a short sci-fi story about a time traveler" },
];

export function homeSuggestions(chats: Chat[]) {
  // Take the most recent chats with user messages, derive a keyword from each.
  const recent = [...chats]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 4);

  const derived: string[] = [];
  for (const c of recent) {
    const userMsg: ChatMessage | undefined = c.messages.find((m) => m.role === "user");
    if (!userMsg) continue;
    const words = userMsg.content.split(/\s+/).filter((w) => w.length > 3);
    if (words.length === 0) continue;
    // Build a short suggestion echoing the recent topic.
    const trimmed = userMsg.content.trim().slice(0, 60);
    derived.push(`Continue: ${trimmed}${trimmed.length >= 60 ? "…" : ""}`);
  }

  if (derived.length === 0) return STATIC_SUGGESTIONS.map((s) => ({ ...s }));

  // Fill up to 4 slots with static fallbacks.
  while (derived.length < 4) {
    for (const s of STATIC_SUGGESTIONS) {
      if (!derived.includes(s.text)) {
        derived.push(s.text);
        break;
      }
    }
    if (derived.length < 4) break;
  }
  return derived.map((text) => ({ icon: "💬", text }));
}

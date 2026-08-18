import type { Chat, ChatMessage } from "./storage";

const MAX_SHARE_BYTES = 1900; // stay well below ~2KB URL limits

function esc(md: string): string {
  return md; // messages are our own content
}

/** Download the chat as a Markdown file. */
export function downloadMarkdown(chat: Chat) {
  const lines: string[] = [];
  lines.push(`# ${chat.title}`);
  lines.push("");
  lines.push(`**Asky chat** · ${new Date(chat.updatedAt).toLocaleString()}`);
  lines.push("");
  for (const m of chat.messages) {
    if (m.role === "user") {
      lines.push(`## User`);
      lines.push("");
      lines.push(esc(m.content));
      if (m.image) lines.push("\n*[image attached]*");
      lines.push("");
    } else {
      lines.push(`## Asky`);
      lines.push("");
      if (m.reasoning?.trim()) {
        lines.push("> *Thought for a moment…*\n");
        lines.push(esc(m.reasoning));
        lines.push("");
      }
      lines.push(esc(m.content || (m.error ? `⚠ Error: ${m.error}` : "")));
      lines.push("");
    }
  }
  const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${(chat.title || "chat").replace(/[^\w-]+/g, "_").slice(0, 60)}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Download the chat as JSON (full fidelity, usable for import). */
export function downloadJson(chat: Chat) {
  const blob = new Blob([JSON.stringify(chat, null, 2)], { type: "application/json;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${(chat.title || "chat").replace(/[^\w-]+/g, "_").slice(0, 60)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Compact payload for a shareable URL (kept small, no images). */
export interface SharePayload {
  t?: string; // title
  m: Array<{ r: "u" | "a"; c: string; i?: boolean }>;
  k?: string; // model key
}

export function chatToPayload(chat: Chat): SharePayload {
  return {
    t: chat.title || undefined,
    m: chat.messages.map((m) => ({
      r: m.role === "user" ? "u" : "a",
      c: m.content,
      ...(m.image ? { i: true } : {}),
    })),
    k: chat.modelKey,
  };
}

export function chatToJsonForShare(chat: Chat): string {
  return JSON.stringify(chatToPayload(chat));
}

/** Validate imported JSON. Returns a ChatMessage array or throws. */
export function parseSharedMessages(raw: string): { messages: ChatMessage[]; title?: string; modelKey?: string } {
  let data: SharePayload;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Not a valid Asky chat link.");
  }
  if (!data || !Array.isArray(data.m)) throw new Error("Not a valid Asky chat link.");
  const now = Date.now();
  const messages: ChatMessage[] = data.m.map((x, i) => ({
    id: `imp${i}`,
    role: x.r === "u" ? "user" : "assistant",
    content: x.c ?? "",
    ...(x.i ? { image: "" } : {}),
    done: true,
    createdAt: now + i,
  }));
  return { messages, title: data.t, modelKey: data.k };
}

/** Encode a chat into a short base64url string, truncating if it would exceed the size cap. */
export function encodeShareString(chat: Chat): string {
  const json = chatToJsonForShare(chat);
  if (json.length > MAX_SHARE_BYTES) {
    // Trim oldest messages until small enough (keep at least user msg + assistant reply)
    const payload = chatToPayload(chat);
    // Base64url grows ~4/3, so trim JSON to ~3/4 of the cap before encoding
    const jsonCap = Math.floor(MAX_SHARE_BYTES * 0.72);
    while (payload.m.length > 2 && JSON.stringify(payload).length > jsonCap) {
      payload.m.shift();
    }
    const trimmed = JSON.stringify(payload);
    if (trimmed.length <= jsonCap) {
      return toBase64Url(trimmed);
    }
    // Single message fallback
    const last = payload.m[payload.m.length - 1];
    const short: SharePayload = { m: [last], k: payload.k };
    let s = JSON.stringify(short);
    while (s.length > jsonCap) {
      last.c = last.c.slice(0, Math.max(last.c.length - 64, 20));
      s = JSON.stringify(short);
    }
    return toBase64Url(s);
  }
  return toBase64Url(json);
}

export function decodeShareString(s: string): string {
  try {
    return fromBase64Url(s);
  } catch {
    throw new Error("Not a valid Asky chat link.");
  }
}

export function toBase64Url(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function fromBase64Url(s: string): string {
  let b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  return decodeURIComponent(escape(atob(b64)));
}

export function buildShareUrl(chat: Chat): string {
  const base = window.location.origin + window.location.pathname;
  return `${base}?share=${encodeShareString(chat)}`;
}

/** Download the chat as a plain text file. */
export function downloadTxt(chat: Chat) {
  const lines: string[] = [];
  lines.push(`${chat.title}`);
  lines.push("");
  lines.push(`Exported: ${new Date(chat.updatedAt).toLocaleString()}`);
  lines.push("");
  for (const m of chat.messages) {
    if (m.role === "user") {
      lines.push(`== You ==`);
      lines.push("");
      lines.push(m.content);
      if (m.image) lines.push("[image attached]");
      lines.push("");
    } else {
      lines.push(`== Asky ==`);
      lines.push("");
      if (m.reasoning?.trim()) {
        lines.push(`[thought] ${m.reasoning}`);
        lines.push("");
      }
      lines.push(m.content || (m.error ? `[error: ${m.error}]` : ""));
      lines.push("");
    }
  }
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${(chat.title || "chat").replace(/[^\w-]+/g, "_").slice(0, 60)}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/**
 * Export the chat in WhatsApp-friendly plain text: *bold* labels, > quotes,
 * timestamps, so pasting into WhatsApp keeps formatting.
 */
export function chatToWhatsAppText(chat: Chat): string {
  const lines: string[] = [];
  lines.push(`*${chat.title || "Chat"}*`);
  lines.push(`_Exported: ${new Date(chat.updatedAt).toLocaleString()}_`);
  lines.push("");
  for (const m of chat.messages) {
    const when = m.createdAt ? new Date(m.createdAt).toLocaleString() : "";
    if (m.role === "user") {
      const label = when ? `*You* (${when})` : `*You*`;
      lines.push(label);
      for (const line of (m.content || "").split("\n")) {
        lines.push(`> ${line}`);
      }
      if (m.image) lines.push("> _[image attached]_");
      lines.push("");
    } else {
      const label = when ? `*Asky* (${when})` : `*Asky*`;
      lines.push(label);
      if (m.reasoning?.trim()) {
        for (const line of m.reasoning.split("\n")) {
          lines.push(`> _[thought] ${line}_`);
        }
        lines.push("");
      }
      if (m.error) {
        lines.push("> _[error] " + m.error + "_");
      } else {
        for (const line of (m.content || "").split("\n")) {
          lines.push(`> ${line}`);
        }
      }
      lines.push("");
    }
  }
  return lines.join("\n").replace(/\n+\n+/g, "\n\n").trim() + "\n";
}

/** Copy the chat as WhatsApp-formatted text to clipboard and download as .txt. */
export async function exportChatToWhatsApp(chat: Chat) {
  const text = chatToWhatsAppText(chat);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${(chat.title || "chat").replace(/[^\w-]+/g, "_").slice(0, 60)}_whatsapp.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
  try {
    await navigator.clipboard.writeText(text);
    return { downloaded: true, copied: true };
  } catch {
    return { downloaded: true, copied: false };
  }
}

/** Rough word + token estimate for a chat (tokens ≈ 1.33 × words). */
export function chatWordCount(chat: Chat) {
  let words = 0;
  for (const m of chat.messages) {
    if (m.content) words += m.content.split(/\s+/).filter(Boolean).length;
  }
  return { words, tokens: Math.ceil(words * 1.33) };
}

/** Download every chat as a zip containing one folder per chat (Markdown + JSON). */
export async function exportAllChatsZip(chats: Chat[]) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const sanitize = (name: string) => (name || "chat").replace(/[\\/:*?"<>|]/g, "_").trim() || "chat";
  for (const chat of chats) {
    const name = sanitize(chat.title);
    const folder = zip.folder(name);
    if (!folder) continue;
    const mdLines: string[] = [];
    mdLines.push(`# ${chat.title}`);
    mdLines.push("");
    mdLines.push(`**Asky chat** · ${new Date(chat.updatedAt).toLocaleString()}`);
    mdLines.push("");
    for (const m of chat.messages) {
      if (m.role === "user") {
        mdLines.push(`## User`);
        mdLines.push("");
        mdLines.push(m.content);
        if (m.image) mdLines.push("\n*[image attached]*");
        mdLines.push("");
      } else {
        mdLines.push(`## Asky`);
        mdLines.push("");
        if (m.reasoning?.trim()) {
          mdLines.push("> *Thought for a moment…*\n");
          mdLines.push(m.reasoning);
          mdLines.push("");
        }
        mdLines.push(m.content || (m.error ? `⚠ Error: ${m.error}` : ""));
        mdLines.push("");
      }
    }
    folder.file(`${name}.md`, mdLines.join("\n"));
    folder.file(`${name}.json`, JSON.stringify(chat, null, 2));
  }
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `asky-all-chats-${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

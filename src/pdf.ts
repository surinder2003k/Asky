import type { Chat, ChatMessage } from "./storage";
import { marked } from "marked";

const CSS = `
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1a1a1a; max-width: 780px; margin: 0 auto; padding: 32px 24px; line-height: 1.6; }
  h1 { font-size: 22px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
  .meta { color: #6b7280; font-size: 12px; margin-bottom: 24px; }
  .msg { margin-bottom: 20px; page-break-inside: avoid; }
  .role { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 2px; }
  .user-msg .role { color: #0f766e; }
  .user-msg { background: #f0fdfa; border-radius: 12px; padding: 12px 16px; }
  .assistant-msg { background: #f9fafb; border-radius: 12px; padding: 12px 16px; }
  pre { background: #111827; color: #e5e7eb; border-radius: 8px; padding: 12px; overflow-x: auto; font-size: 12.5px; }
  code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 12.5px; }
  p { margin: 0 0 8px 0; }
  ul, ol { margin: 0 0 8px 0; padding-left: 22px; }
  blockquote { border-left: 3px solid #d1d5db; margin: 0 0 8px 0; padding-left: 12px; color: #4b5563; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 13px; }
  th, td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; }
  th { background: #f3f4f6; }
  @media print { body { padding: 0; } }
`;

function renderMessage(m: ChatMessage): string {
  const roleLabel = m.role === "user" ? "You" : "Asky";
  const html = m.role === "user" ? escapeHtml(m.content) : marked.parse(m.content || "") as string;
  return `<div class="msg ${m.role}-msg">
    <div class="role">${roleLabel}</div>
    <div>${html}</div>
  </div>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
}

export function chatHtmlForPdf(chat: Chat): string {
  const date = new Date(chat.updatedAt).toLocaleString();
  const messages = chat.messages.map(renderMessage).join("");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(chat.title)} — Asky</title>
<style>${CSS}</style>
</head>
<body>
<h1>${escapeHtml(chat.title)}</h1>
<div class="meta">Exported from Asky · ${date}</div>
${messages}
</body>
</html>`;
}

let pdfWindow: Window | null = null;

/** Open a print-ready window for saving the chat as PDF via the browser's print dialog. */
export function exportChatToPdf(chat: Chat) {
  if (pdfWindow && !pdfWindow.closed) {
    pdfWindow.close();
  }
  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) return;
  w.document.write(chatHtmlForPdf(chat));
  w.document.close();
  pdfWindow = w;
  // Give images/fonts a beat, then trigger print.
  setTimeout(() => {
    try {
      w.print();
    } catch {
      // print unavailable — leave the window open for manual print
    }
  }, 350);
}

/** Save the assistant reply (single message) as PDF. */
export function exportMessageToPdf(chat: Chat, msg: ChatMessage) {
  const synthetic: Chat = {
    ...chat,
    title: chat.title ? `${chat.title} — reply` : "Asky reply",
    messages: [msg],
  };
  exportChatToPdf(synthetic);
}

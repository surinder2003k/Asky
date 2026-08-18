import type { Chat, ChatMessage } from "./storage";
import { marked } from "marked";

const LIGHT_BG = "#ffffff";
const LIGHT_FG = "#1a1a1a";
const LIGHT_MUTED = "#6b7280";
const LIGHT_BUBBLE = "#f0fdfa";
const LIGHT_AI_BUBBLE = "#f9fafb";
const LIGHT_BORDER = "#e5e7eb";

const DARK_BG = "#171717";
const DARK_FG = "#ececec";
const DARK_MUTED = "#9ca3af";
const DARK_BUBBLE = "#262626";
const DARK_AI_BUBBLE = "#202020";
const DARK_BORDER = "#333333";

function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c] as string),
  );
}

function inlineMd(md: string): string {
  // Render markdown to HTML then flatten block tags to divs for compact card layout.
  return (marked.parse(md) as string)
    .replace(/<\/?(h1|h2|h3|p)[^>]*>/g, "")
    .replace(/<li>/g, "<div>• ")
    .replace(/<\/li>/g, "</div>")
    .replace(/<\/?(ul|ol|blockquote)[^>]*>/g, "")
    .replace(/<strong>/g, "<div style=\"font-weight:700\">")
    .replace(/<pre[^>]*>/g, "<div style=\"font-family:ui-monospace,monospace;font-size:11px;background:#111827;color:#e5e7eb;padding:8px;border-radius:6px;margin-top:6px\">")
    .replace(/<\/pre>/g, "</div>")
    .replace(/<code[^>]*>/g, "<span style=\"font-family:ui-monospace,monospace;font-size:11px\">")
    .replace(/<\/code>/g, "</span>")
    .replace(/<br\s*\/?>/g, "<div/>");
}

function countUnits(html: string): number {
  // Rough vertical unit count: each div/br-like block ≈ 1 line.
  return Math.max(1, (html.match(/<div/g) || []).length) + (html.match(/<span/g) || []).length / 6;
}

function wrapLines(text: string, max: number): string[] {
  const out: string[] = [];
  for (const raw of text.split("\n")) {
    if (raw.length <= max) {
      out.push(raw);
      continue;
    }
    for (let i = 0; i < raw.length; i += max) out.push(raw.slice(i, i + max));
  }
  return out;
}

interface RenderedMsg {
  html: string;
  height: number;
}

function renderMessage(m: ChatMessage, isDark: boolean): RenderedMsg {
  const fg = isDark ? DARK_FG : LIGHT_FG;
  const muted = isDark ? DARK_MUTED : LIGHT_MUTED;
  const roleLabel = m.role === "user" ? "You" : "Asky";
  const roleColor = m.role === "user" ? (isDark ? "#5eead4" : "#0f766e") : muted;
  const bubble =
    m.role === "user"
      ? isDark ? DARK_BUBBLE : LIGHT_BUBBLE
      : isDark ? DARK_AI_BUBBLE : LIGHT_AI_BUBBLE;
  const border = isDark ? DARK_BORDER : LIGHT_BORDER;

  if (m.role === "user") {
    const lines = wrapLines(m.content, 60);
    const h = 12 + 20 + lines.length * 20 + 12 + (m.image ? 150 : 0);
    return {
      html: `<div style="background:${bubble};border:1px solid ${border};border-radius:14px;padding:12px 16px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:${roleColor};margin-bottom:2px">${escapeXml(roleLabel)}</div>
        ${lines.map((l) => `<div style="color:${fg};font-size:14px;line-height:20px">${escapeXml(l)}</div>`).join("")}
      </div>`,
      height: h,
    };
  }

  const html = inlineMd(m.content);
  const units = countUnits(html);
  const h = 12 + 20 + units * 18 + 14;
  return {
    html: `<div style="background:${bubble};border:1px solid ${border};border-radius:14px;padding:12px 16px;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:${roleColor};margin-bottom:2px">${escapeXml(roleLabel)}</div>
      <div style="color:${fg};font-size:14px;line-height:18px">${html}</div>
    </div>`,
    height: h,
  };
}

export function chatSvgForPng(chat: Chat, isDark: boolean): { svg: string; width: number; height: number } {
  const bg = isDark ? DARK_BG : LIGHT_BG;
  const fg = isDark ? DARK_FG : LIGHT_FG;
  const muted = isDark ? DARK_MUTED : LIGHT_MUTED;
  const width = 760;
  const headerH = 56;
  const items = chat.messages.map((m) => renderMessage(m, isDark));
  const bodyH = items.reduce((a, b) => a + b.height + 12, 0);
  const height = Math.min(headerH + bodyH + 20, 40000);
  const body = items.map((x) => x.html).join("");
  return {
    width,
    height,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="${width}" height="${height}" fill="${bg}" rx="16"/>
      <foreignObject width="${width}" height="${height}">
        <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;padding:16px 24px;box-sizing:border-box;">
          <div style="color:${fg};font-size:16px;font-weight:700">${escapeXml(chat.title)}</div>
          <div style="color:${muted};font-size:11px">${new Date(chat.updatedAt).toLocaleString()}</div>
          ${body}
        </div>
      </foreignObject>
    </svg>`,
  };
}

export function messageSvgForPng(chat: Chat, msg: ChatMessage, isDark: boolean): { svg: string; width: number; height: number } {
  const bg = isDark ? DARK_BG : LIGHT_BG;
  const fg = isDark ? DARK_FG : LIGHT_FG;
  const muted = isDark ? DARK_MUTED : LIGHT_MUTED;
  const width = 760;
  const { html, height: msgH } = renderMessage(msg, isDark);
  const height = 56 + msgH + 16;
  return {
    width,
    height,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="${width}" height="${height}" fill="${bg}" rx="16"/>
      <foreignObject width="${width}" height="${height}">
        <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;padding:16px 24px;box-sizing:border-box;">
          <div style="color:${fg};font-size:16px;font-weight:700">${escapeXml(chat.title)}</div>
          <div style="color:${muted};font-size:11px">${new Date(chat.updatedAt).toLocaleString()}</div>
          <div style="margin-top:10px">${html}</div>
        </div>
      </foreignObject>
    </svg>`,
  };
}

function svgToCanvas(svg: string): Promise<CanvasRenderingContext2D | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      URL.revokeObjectURL(url);
      if (!ctx) return resolve(null);
      ctx.drawImage(img, 0, 0);
      resolve(ctx);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

export async function downloadChatPng(chat: Chat) {
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";
  const { svg, width, height } = chatSvgForPng(chat, isDark);
  if (width * height > 16_000_000) {
    downloadSvg(svg, `${slug(chat.title)}.svg`);
    return;
  }
  const ctx = await svgToCanvas(svg);
  if (!ctx) {
    downloadSvg(svg, `${slug(chat.title)}.svg`);
    return;
  }
  blobFromCanvas(ctx.canvas, `${slug(chat.title)}.png`);
}

export async function downloadMessagePng(chat: Chat, msg: ChatMessage) {
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";
  const { svg } = messageSvgForPng(chat, msg, isDark);
  const ctx = await svgToCanvas(svg);
  if (!ctx) {
    downloadSvg(svg, "asky-reply.svg");
    return;
  }
  blobFromCanvas(ctx.canvas, "asky-reply.png");
}

function blobFromCanvas(canvas: HTMLCanvasElement, name: string) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }, "image/png");
}

function downloadSvg(svg: string, name: string) {
  const a = document.createElement("a");
  a.href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  a.download = name;
  a.click();
}

function slug(title: string) {
  return (title || "chat").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60) || "chat";
}

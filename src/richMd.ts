/**
 * Rich markdown rendering: tables + fenced diagrams (mermaid) + LaTeX math ($ / $$)
 * on top of the existing marked + DOMPurify pipeline.
 *
 * Strategy: pre-process the source text before marked so that math and mermaid
 * fences survive marked's escaping, then post-process marked's HTML to render
 * mermaid blocks via the mermaid library and math via KaTeX (client-side).
 */
import DOMPurify from "dompurify";
import katex from "katex";
import { marked } from "marked";
import mermaid from "mermaid";

let mermaidInit = false;
function ensureMermaid() {
  if (mermaidInit) return;
  mermaidInit = true;
  mermaid.initialize({
    startOnLoad: false,
    theme: "dark",
    securityLevel: "loose",
    fontFamily: "inherit",
  });
}

/** Sentinel placeholders that survive marked parsing. */
const MERMAID_PH = "MERMAID_BLOCK";
const MATH_PH = "MATH_BLOCK";

const htmlEsc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function preprocess(src: string): { text: string; mathMap: Map<string, { display: boolean; tex: string }>; mermaidMap: Map<string, string> } {
  const mathMap = new Map<string, { display: boolean; tex: string }>();
  const mermaidMap = new Map<string, string>();

  // Protect fenced mermaid + math blocks from marked.
  let text = src.replace(/```mermaid\s*\n([\s\S]*?)```/g, (_, code: string) => {
    const key = `${MERMAID_PH}_${mermaidMap.size}`;
    mermaidMap.set(key, code.trim());
    return `\n\n${key}\n\n`;
  });

  text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_m, tex: string) => {
    const key = `${MATH_PH}D_${mathMap.size}`;
    mathMap.set(key, { display: true, tex: tex.trim() });
    return `\n${key}\n`;
  });

  text = text.replace(/\$([^\n$]+?)\$/g, (_m, tex: string) => {
    const key = `${MATH_PH}I_${mathMap.size}`;
    mathMap.set(key, { display: false, tex: tex.trim() });
    return key;
  });

  return { text, mathMap, mermaidMap };
}

/** Post-process marked HTML: render math via KaTeX and tag mermaid placeholders. */
function postprocess(
  html: string,
  mathMap: Map<string, { display: boolean; tex: string }>,
  mermaidMap: Map<string, string>,
): string {
  let out = html;

  for (const [key, { display, tex }] of mathMap) {
    let rendered: string;
    try {
      rendered = katex.renderToString(tex, {
        displayMode: display,
        throwOnError: false,
        trust: true,
      });
    } catch {
      rendered = `<code>${htmlEsc(tex)}</code>`;
    }
    const wrap = display
      ? `<div class="math-block">${rendered}</div>`
      : `<span class="math-inline">${rendered}</span>`;
    out = out.split(key).join(wrap);
  }

  for (const [key, code] of mermaidMap) {
    const cls = "mermaid";
    const ph = `<pre><code class="language-mermaid" data-mermaid-src="${htmlEsc(code)}">${htmlEsc(code)}</code></pre>`;
    // Replace any occurrence (including ones marked may have wrapped in <p>)
    out = out.replace(new RegExp(`<p>\\s*${key}\\s*</p>`, "g"), ph);
    out = out.split(key).join(ph);
  }

  return out;
}

const renderer = new marked.Renderer();
// Mobile/tablet fix: wrap every markdown table in a horizontal-scroll container
// so a wide table can never push the message wider than the chat column.
// Render table cells (header/body are arrays of cell/row tokens in newer marked).
function renderTableCell(c: any, head: boolean): string {
  const tag = head ? "th" : "td";
  return `<${tag}${c.align ? ` align="${c.align}"` : ""}>${c.text ?? ""}</${tag}>`;
}
function renderTableRow(r: any, head: boolean): string {
  return `<tr>${(Array.isArray(r) ? r : []).map((c: any) => renderTableCell(c, head)).join("")}</tr>`;
}
// Convert a marked table token into CSV rows (cells are stripped of markdown/HTML).
function tableToCsv(token: any): string {
  const esc = (s: string) => {
    const t = (s ?? "").replace(/<[^>]+>/g, "").trim();
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const head = (token.header ?? []).map((c: any) => esc(c.text)).join(",");
  const rows = (token.rows ?? []).map((r: any) =>
    (Array.isArray(r) ? r : []).map((c: any) => esc(c.text)).join(","),
  );
  return [head, ...rows].filter(Boolean).join("\n");
}

// CSV payloads collected in render order; each table emits a unique
// placeholder that survives DOMPurify so the payloads can be restored after.
const csvQueue: string[] = [];
renderer.table = (token: any) => {
  const headerRow = `<tr>${(token.header ? token.header : []).map((c: any) => renderTableCell(c, true)).join("")}</tr>`;
  // marked's Table token: `header` = header cells, `rows` = body row arrays
  const bodyRows = token.rows ? token.rows.map((r: any) => renderTableRow(r, false)).join("") : "";
  // Tap-to-copy: the csv payload is carried in a hidden textarea (textContent
  // survives DOMPurify). Multiple tables get ordered placeholders restored
  // after sanitization so each wrapper keeps its own csv.
  csvQueue.push(tableToCsv(token));
  const ph = `TABLECSV_${csvQueue.length}`;
  return `<div class="table-wrap"><textarea class="table-csv-src" hidden>${ph}</textarea><table><thead>${headerRow}</thead><tbody>${bodyRows}</tbody></table></div>`;
};
renderer.code = ({ text, lang }) => {
  const l = String(lang ?? "").trim().toLowerCase();
  if (l === "html" || l === "html5" || l === "htm") {
    // NOTE: DOMPurify strips `data-*` attributes, so the source must live INSIDE
    // the element as text content (DOMPurify keeps textContent). mountCodePreviews
    // reads it from the nested <textarea class="code-html-src"> and then removes it.
    const esc = htmlEsc(text);
    return `<div class="code-html-block"><textarea class="code-html-src" hidden>${esc}</textarea><pre><code class="language-html">${esc}</code></pre></div>`;
  }
  if (l === "mermaid") {
    return `<pre><code class="language-mermaid" data-mermaid-src="${htmlEsc(text.trim())}">${htmlEsc(text)}</code></pre>`;
  }
  return `<pre><code class="language-${l}">${htmlEsc(text)}</code></pre>`;
};

/** Parse markdown to sanitized HTML (math/mermaid placeholders included). */
export function renderRichMd(text: string): string {
  // Fresh render → fresh queue, so each render's placeholders line up 1:1 with its tables.
  csvQueue.length = 0;
  const { text: pre, mathMap, mermaidMap } = preprocess(text || "");
  const raw = marked.parse(pre, { renderer, breaks: true, gfm: true }) as string;
  const post = postprocess(raw, mathMap, mermaidMap);
  // DOMPurify strips `data-*` attributes, so the renderer carries each table's
  // csv in a hidden <textarea> via ordered placeholders; restore them here so
  // each wrapper keeps its own data (works even with repeated csv text).
  let out = post;
  for (let i = 1; i <= csvQueue.length; i++) {
    out = out.split(`TABLECSV_${i}`).join(csvQueue[i - 1]);
  }
  return out;
}

/**
 * Wire tap-to-copy on table wrappers: click/tap anywhere on a table copies
 * its data as CSV to the clipboard and shows brief "Table copied" feedback.
 * Call after a message's DOM mounts / updates.
 */
export function mountTableCopyHandlers(root: HTMLElement): void {
  const wraps = root.querySelectorAll<HTMLDivElement>(".table-wrap");
  wraps.forEach((w) => {
    if ((w as any).__askyCopyBound) return;
    (w as any).__askyCopyBound = true;
    const src = w.querySelector<HTMLTextAreaElement>("textarea.table-csv-src");
    const csv = src ? src.value : null;
    w.addEventListener("click", async (e: Event) => {
      // Ignore clicks that are really selection or link activation.
      const target = e.target as HTMLElement | null;
      if (target && (target.closest("a") || (target.tagName || "") === "A")) return;
      if (!csv) return;
      try {
        await navigator.clipboard.writeText(csv);
      } catch {
        // Clipboard API unavailable (insecure context) — fail silently.
        return;
      }
      const existed = w.querySelector(".table-copied-hint");
      if (existed) return; // already showing feedback
      const hint = document.createElement("div");
      hint.className = "table-copied-hint";
      hint.textContent = "Table copied";
      w.appendChild(hint);
      setTimeout(() => hint.remove(), 1400);
    });
  });
}

/**
 * Render pending mermaid diagrams found in the given container.
 * Call after the message DOM mounts / updates (useEffect after render).
 */
export async function renderMermaidBlocks(root: HTMLElement): Promise<void> {
  const blocks = root.querySelectorAll<HTMLElement>("code.language-mermaid");
  if (!blocks.length) return;
  ensureMermaid();
  try {
    const { svg } = await mermaid.render("mm-" + Math.random().toString(36).slice(2, 9), blocks[0].textContent ?? "");
    const parent = blocks[0].parentElement;
    if (parent) {
      parent.outerHTML = `<div class="mermaid-diagram">${svg}</div>`;
    }
  } catch {
    /* leave the plain code fallback visible */
  }
}

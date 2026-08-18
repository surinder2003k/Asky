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
renderer.code = ({ text, lang }) => {
  const l = String(lang ?? "").trim().toLowerCase();
  if (l === "html" || l === "html5" || l === "htm") {
    const src = encodeURIComponent(text);
    return `<div class="code-html-block" data-html-src="${src}">[html preview]</div>`;
  }
  if (l === "mermaid") {
    return `<pre><code class="language-mermaid" data-mermaid-src="${htmlEsc(text.trim())}">${htmlEsc(text)}</code></pre>`;
  }
  return `<pre><code class="language-${l}">${htmlEsc(text)}</code></pre>`;
};

/** Parse markdown to sanitized HTML (math/mermaid placeholders included). */
export function renderRichMd(text: string): string {
  const { text: pre, mathMap, mermaidMap } = preprocess(text || "");
  const raw = marked.parse(pre, { renderer, breaks: true, gfm: true }) as string;
  const post = postprocess(raw, mathMap, mermaidMap);
  const sanitizeFn = typeof DOMPurify.sanitize === "function" ? DOMPurify.sanitize : null;
  return sanitizeFn ? sanitizeFn(post) : post;
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

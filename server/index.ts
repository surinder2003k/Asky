import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const PORT = Number(process.env.PORT || 3001);
const isProd = process.env.NODE_ENV === "production";

app.use(express.json({ limit: "30mb" }));

// ── CORS for the same-origin web app (dev: vite proxy forwards; prod: same host)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

interface ProviderInfo {
  url: string;
  header: string;
  bare?: boolean;
}

const PROVIDERS: Record<string, ProviderInfo> = {
  nvidia: { url: "https://integrate.api.nvidia.com/v1", header: "Authorization" },
  mistral: { url: "https://api.mistral.ai/v1", header: "Authorization", bare: true },
  groq: { url: "https://api.groq.com/openai/v1", header: "Authorization", bare: true },
  openrouter: { url: "https://openrouter.ai/api/v1", header: "Authorization" },
  opencode: { url: "https://opencode.ai/zen/v1", header: "Authorization", bare: true },
};

// Open-source site: NO built-in keys — users bring their own API keys.

function pickKey(providerKey: string, userKey?: string): string {
  if (userKey && userKey.trim()) return userKey.trim();
  return "";
}

const TIMEOUT = 90000;

app.post("/api/chat", async (req, res) => {
  const { providerKey, apiKey, modelId, body } = req.body || {};
  const provider = PROVIDERS[providerKey];
  if (!provider) return res.status(400).json({ error: { message: "Unknown provider" } });
  const key = pickKey(providerKey, apiKey);
  if (!key)
    return res.status(401).json({
      error: { message: "No API key for this provider. Add it in Settings → API Keys." },
    });

  const targetUrl = `${provider.url}/chat/completions`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    [provider.header]: provider.bare ? key : `Bearer ${key}`,
  };
  if (providerKey === "openrouter") {
    headers["HTTP-Referer"] = "https://asky.manus.space";
    headers["X-Title"] = "Asky";
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      let detail = "";
      try {
        const j = JSON.parse(text);
        detail = j?.error?.message || j?.message || "";
        if (j?.error?.code) detail += detail ? ` (${j.error.code})` : String(j.error.code);
      } catch {
        detail = text.slice(0, 300);
      }
      return res.status(upstream.status).json({
        error: { message: makeFriendlyError(providerKey, upstream.status, detail, modelId) },
      });
    }

    if (body?.stream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();
      const reader = upstream.body?.getReader();
      if (!reader) return res.status(502).json({ error: { message: "No upstream body" } });
      const decoder = new TextDecoder();
      let buffer = "";
      res.on("close", () => reader.cancel().catch(() => {}));
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          res.write(line + "\n");
        }
      }
      res.write("data: [DONE]\n\n");
      res.end();
    } else {
      const j = await upstream.json();
      res.json(j);
    }
  } catch (err: any) {
    const msg = err?.name === "TimeoutError" || String(err).includes("timed out")
      ? "The model took too long. Try again."
      : String(err?.message || err).slice(0, 200) || "Network request failed";
    res.status(502).json({ error: { message: msg } });
  }
});

// ── Web search: server-side Bing HTML scrape (no key, no CORS issues).
// Returns top results so the chat client can append them as answer context.
app.post("/api/web-search", async (req, res) => {
  const { query } = req.body || {};
  if (!query || typeof query !== "string" || !query.trim()) {
    return res.status(400).json({ error: "Missing search query" });
  }
  try {
    const q = encodeURIComponent(query.trim().slice(0, 200));
    const url = `https://www.bing.com/search?q=${q}&setlang=en&cc=us`;
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Sec-Fetch-Mode": "navigate",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) return res.status(502).json({ error: `Search upstream HTTP ${r.status}` });
    const html = await r.text();
    const results: { title: string; url: string; snippet: string }[] = [];

    // Parse per-result blocks (<li class="b_algo">) so title/snippet stay aligned.
    const blocks = html.split(/<li class="b_algo[^"]*"/);
    for (const block of blocks.slice(1)) {
      if (results.length >= 10) break;
      // Real URL lives inside the u= param of the Bing redirect href.
      const hrefMatch = /href="(https?:\/\/www\.bing\.com\/ck\/a[^"\s]*u=([a-zA-Z0-9%_-]+)[^"]*)"/.exec(block);
      const rawHref = hrefMatch?.[0];
      let realUrl = "";
      if (hrefMatch) {
        try {
          const decoded = Buffer.from(hrefMatch[2], "base64").toString("utf-8");
          if (/^https?:\/\//i.test(decoded)) realUrl = decoded;
        } catch {
          /* ignore */
        }
      }
      const cite = /<cite[^>]*>([\s\S]*?)<\/cite>/.exec(block);
      let citeUrl = "";
      if (cite)
        citeUrl = cite[1]
          .replace(/<[^>]+>/g, "")
          .replace(/&nbsp;/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      // Only keep blocks that have a title link and some identity (cite or url)
      const titleMatch = /<h2[^>]*>\s*<a[^>]*href="[^"]*"[^>]*>([\s\S]*?)<\/a>\s*<\/h2>/.exec(block);
      if (!titleMatch) continue;
      const title = titleMatch[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&#?\w+;/g, (e) => (e.startsWith("&#") ? String.fromCharCode(parseInt(e.slice(2, -1))) : e))
        .replace(/\s+/g, " ")
        .trim();
      if (!title) continue;
      const displayUrl = realUrl || citeUrl.replace(/ › /g, "/");
      const snippetMatch = /class="b_lineclamp[0-9]+">([^<]{8,})/.exec(block);
      let snippet = "";
      if (snippetMatch)
        snippet = snippetMatch[1]
          .replace(/<[^>]+>/g, " ")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&amp;/g, "&")
          .replace(/\s+/g, " ")
          .trim();
      results.push({ title, url: displayUrl, snippet });
    }

    return res.json({ query, results });
  } catch (err: any) {
    return res.status(502).json({ error: err?.message || "Search request failed" });
  }
});

// ── Serve the static web app in production
if (isProd) {
  const distRoot = path.join(
    typeof import.meta.dirname === "string" ? import.meta.dirname : path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "dist",
  );
  app.use(express.static(distRoot, { maxAge: "1h", etag: true }));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distRoot, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`[asky-server] listening on ${PORT} (${isProd ? "prod" : "dev"})`);
});

function makeFriendlyError(providerKey: string, status: number, upstreamMsg: string, model: string): string {
  const isRateLimited =
    status === 429 ||
    status === 403 ||
    /rate.{0,12}limit|FreeUsageLimitError|usage limit|quota/i.test(upstreamMsg);
  const label = getProviderLabel(providerKey);
  const modelName = model ? ` "${model}"` : "";
  if (isRateLimited) {
    return `${label}${modelName}: this model hit its daily free limit. Switch to another model in the picker (others on the same key still work) and retry.`;
  }
  if (status === 401 || /invalid.{0,20}(key|token|api)/i.test(upstreamMsg)) {
    return `${label}: the API key was rejected. Check the key in Settings and save again.`;
  }
  if (status === 504 || /timeout|timed out/i.test(upstreamMsg)) {
    return `${label}: the request took too long. Retry or try a lighter model.`;
  }
  return `${label}: provider error (${status}). ${upstreamMsg}`.trim();
}

function getProviderLabel(key: string): string {
  const labels: Record<string, string> = {
    nvidia: "Nvidia",
    mistral: "Mistral",
    groq: "Groq",
    openrouter: "OpenRouter",
    opencode: "OpenCode Zen",
    gemini: "Gemini",
  };
  return labels[key] ?? key;
}

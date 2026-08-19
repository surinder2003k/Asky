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
}

const PROVIDERS: Record<string, ProviderInfo> = {
  nvidia: { url: "https://integrate.api.nvidia.com/v1", header: "Authorization" },
  mistral: { url: "https://api.mistral.ai/v1", header: "Authorization" },
  groq: { url: "https://api.groq.com/openai/v1", header: "Authorization" },
  openrouter: { url: "https://openrouter.ai/api/v1", header: "Authorization" },
  opencode: { url: "https://opencode.ai/zen/v1", header: "Authorization" },
  opencode_zen: { url: "https://opencode.ai/zen/v1", header: "Authorization" },
  gemini: { url: "https://generativelanguage.googleapis.com/v1beta", header: "Authorization" },
};

// Open-source site: NO built-in keys — users bring their own API keys.

function pickKey(providerKey: string, userKey?: string): string {
  if (userKey && userKey.trim()) return userKey.trim();
  return "";
}

const TIMEOUT = 90000;

app.post("/api/chat", async (req, res) => {
  const { providerKey, apiKey, modelId, body, gemini } = req.body || {};
  const provider = PROVIDERS[providerKey];
  if (!provider) return res.status(400).json({ error: { message: "Unknown provider" } });
  const key = pickKey(providerKey, apiKey);
  if (!key)
    return res.status(401).json({
      error: { message: "No API key for this provider. Add it in Settings → API Keys." },
    });

  // Gemini uses its own REST endpoint shape (handled via its own branch below).
  let targetUrl: string;
  let headers: Record<string, string>;
  let upstreamBody: unknown;
  let isGemini = false;

  if (providerKey === "gemini" && gemini) {
    isGemini = true;
    targetUrl = `${PROVIDERS.gemini.url}/models/${gemini.modelId}:streamGenerateContent?key=${encodeURIComponent(key)}&alt=sse`;
    headers = { "Content-Type": "application/json" };
    upstreamBody = gemini.body;
  } else {
    targetUrl = `${provider.url}/chat/completions`;
    headers = {
      "Content-Type": "application/json",
      [provider.header]: `Bearer ${key}`,
    };
    if (providerKey === "openrouter") {
      headers["HTTP-Referer"] = "https://asky.manus.space";
      headers["X-Title"] = "Asky";
    }
    // CRITICAL: the client sends `body` = { messages, stream, ... } WITHOUT the
    // `model` field. Providers reject any chat request missing `model`, so it
    // MUST be merged into the payload sent upstream (was previously missing —
    // the classic "model field is required" 400).
    upstreamBody = { ...(body ?? {}), model: modelId };
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(upstreamBody),
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
      // Inactivity watchdog: some providers (e.g. Nvidia mini models) keep the
      // connection open but stop sending chunks and never emit [DONE]. Without
      // this, the client cursor blinks forever. 30s of silence cancels the
      // upstream and closes the stream so the client finalizes.
      let idleTimer: ReturnType<typeof setTimeout> | undefined;
      const resetIdle = () => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          clearTimeout(idleTimer);
          reader.cancel().catch(() => {});
          try {
            res.end();
          } catch {
            // response already finished
          }
        }, 30000);
      };
      try {
        resetIdle();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          resetIdle();
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            res.write(line + "\n");
          }
        }
        clearTimeout(idleTimer);
        res.write("data: [DONE]\n\n");
        res.end();
      } catch {
        clearTimeout(idleTimer);
        try {
          res.end();
        } catch {
          // response already finished
        }
      }
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

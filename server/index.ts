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
    [provider.header]: `Bearer ${key}`,
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
        error: { message: detail || `Upstream ${upstream.status}` },
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

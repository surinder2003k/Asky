import type { Express, Request, Response } from "express";

/**
 * AI provider proxy for the web client.
 *
 * Browser JavaScript cannot call the provider endpoints directly — Nvidia,
 * Groq, Mistral and OpenRouter do not send Access-Control-Allow-Origin
 * headers, so a same-origin passthrough is required when Asky runs as a
 * website. The client sends { providerKey, apiKey, modelId, body } and the
 * proxy forwards the exact OpenAI-compatible chat request, streaming the SSE
 * chunks back with correct headers. User API keys are relayed in the request
 * body (never stored server-side); the response is streamed verbatim so the
 * web client can parse deltas exactly like the native fetch path.
 */

const PROVIDER_BASES: Record<string, string> = {
  nvidia: "https://integrate.api.nvidia.com/v1",
  mistral: "https://api.mistral.ai/v1",
  groq: "https://api.groq.com/openai/v1",
  openrouter: "https://openrouter.ai/api/v1",
  opencode_zen: "https://opencode.ai/zen/v1",
  opencode: "https://opencode.ai/zen/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta",
};

const TIMEOUT_MS = 60_000;

interface ProxyBody {
  providerKey?: string;
  apiKey?: string;
  modelId?: string;
  body?: Record<string, unknown>;
  gemini?: { modelId?: string; body?: Record<string, unknown> };
}

export function handleChat(req: Request, res: Response): void | Promise<void> {
  void (async () => {
    const { providerKey, apiKey, modelId, body, gemini } = (req.body ?? {}) as ProxyBody;

    if (!providerKey || !PROVIDER_BASES[providerKey]) {
      res.status(400).json({ error: `Unknown provider: ${providerKey}` });
      return;
    }

    if (!apiKey || !apiKey.trim()) {
      res.status(401).json({ error: { message: "No API key for this provider. Add it in Settings → API Keys." } });
      return;
    }

    if (providerKey === "gemini" && gemini) {
      const url = `${PROVIDER_BASES.gemini}/models/${gemini.modelId}:streamGenerateContent?key=${encodeURIComponent(apiKey ?? "")}&alt=sse`;
      await streamRelay(res, url, "POST", { "Content-Type": "application/json" }, gemini.body, gemini);
      return;
    }

    if (!modelId || !body) {
      res.status(400).json({ error: "Missing modelId or body" });
      return;
    }

    const url = `${PROVIDER_BASES[providerKey]}/chat/completions`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };
    if (providerKey === "openrouter") {
      headers["HTTP-Referer"] = "https://manus.im";
      headers["X-Title"] = "Asky";
    }

    console.log(`[aiProxy] chat provider=${providerKey} modelId=${modelId}`);
    await streamRelay(res, url, "POST", headers, body, { ...body, model: modelId });
  })();
}

export function registerAiProxy(app: Express) {
  app.post("/api/ai-proxy/chat", handleChat);
  // Alias used by the Asky scratch website client (fetch("/api/chat"))
  app.post("/api/chat", handleChat);
  registerTestRoute(app);
}

function registerTestRoute(app: Express) {
  app.post("/api/ai-proxy/test", async (req: Request, res: Response) => {
    const { providerKey, apiKey, modelId } = (req.body ?? {}) as ProxyBody;
    if (!providerKey || !PROVIDER_BASES[providerKey]) {
      res.status(400).json({ error: `Unknown provider: ${providerKey}` });
      return;
    }
    if (!apiKey || !modelId) {
      res.status(400).json({ error: "Missing apiKey or modelId" });
      return;
    }

    const timer = setTimeout(() => res.status(504).json({ ok: false, message: "Network request timed out" }), TIMEOUT_MS);
    try {
      const url = `${PROVIDER_BASES[providerKey]}/chat/completions`;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      };
      if (providerKey === "openrouter") {
        headers["HTTP-Referer"] = "https://manus.im";
        headers["X-Title"] = "AI Chat";
      }
      const r = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ model: modelId, messages: [{ role: "user", content: "Say OK" }], max_tokens: 10 }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      clearTimeout(timer);
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        res.json({ ok: false, message: `${getProviderLabel(providerKey)} API error ${r.status}: ${t}` });
        return;
      }
      res.json({ ok: true, message: "Key is working!" });
    } catch (e) {
      clearTimeout(timer);
      res.json({ ok: false, message: `Network error: ${e instanceof Error ? e.message : String(e)}` });
    }
  });
}


async function streamRelay(
  res: Response,
  url: string,
  method: string,
  headers: Record<string, string>,
  body: unknown,
  sentBody: unknown,
): Promise<void> {
  const timer = setTimeout(() => res.status(504).end(), TIMEOUT_MS);
  try {
    const upstream = await fetch(url, {
      method,
      headers,
      body: JSON.stringify(body),
      // Let the upstream fail fast (do not hang the client forever).
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    clearTimeout(timer);
    res.status(upstream.status);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Request-Body", JSON.stringify(sentBody).slice(0, 2000));

    if (!upstream.body) {
      res.end();
      return;
    }
    const reader = upstream.body.getReader();
    const pump = async (): Promise<void> => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            res.end();
            return;
          }
          if (!res.write(value)) {
            reader.cancel();
            res.end();
            return;
          }
        }
      } catch {
        try {
          res.end();
        } catch {
          // response already finished
        }
      }
    };
    await pump();
  } catch (e) {
    clearTimeout(timer);
    try {
      res.status(502).json({ error: `Upstream error: ${e instanceof Error ? e.message : String(e)}` });
    } catch {
      // response already finished
    }
  }
}

function getProviderLabel(key: string): string {
  const labels: Record<string, string> = {
    nvidia: "Nvidia",
    mistral: "Mistral",
    groq: "Groq",
    openrouter: "OpenRouter",
    opencode_zen: "Opencode Zen",
    opencode: "OpenCode Zen",
    gemini: "Gemini",
  };
  return labels[key] ?? key;
}

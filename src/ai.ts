import { getModel, resolveModelId, type ModelDef } from "./providers";
import type { ChatMessage } from "./storage";
import { isRateLimitError, recordModelStatus } from "./modelStatus";

export interface StreamCallbacks {
  onDelta: (text: string) => void;
  onReasoning?: (text: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
}

export interface GenParams {
  temperature?: number;
  top_p?: number;
}

function decodeError(err: unknown): string {
  if (err instanceof Error) {
    // A network TypeError (fetch failed / DNS / offline) deserves a friendly message.
    if (err.name === "TypeError" && /fetch|network|load/i.test(err.message)) {
      return "Check your internet connection and try again.";
    }
    return err.message;
  }
  return String(err);
}

const TIMEOUT_MS = 90000;

/**
 * Remove failed/empty trailing assistant messages from history before sending.
 * Providers like Mistral reject sequences ending with an empty assistant role,
 * so messages that errored out must not be kept as real history.
 */
function cleanHistory(messages: ChatMessage[]): ChatMessage[] {
  // Providers reject assistant messages with empty content anywhere in the
  // sequence, so drop every failed/empty assistant (not just trailing ones).
  const out: ChatMessage[] = [];
  for (const m of messages) {
    if (m.role === "assistant" && (!m.content || m.error)) continue;
    out.push(m);
  }
  return out;
}

/**
 * Stream a chat reply through the same-origin API proxy (/api/chat).
 * The proxy handles CORS and relays SSE from the provider.
 */
export function streamChat(
  providerKey: ModelDef["provider"],
  apiKey: string,
  modelKey: string,
  messages: ChatMessage[],
  abort: AbortController,
  cb: StreamCallbacks,
  opts: { params?: GenParams } = {},
) {
  const model = getModel(modelKey);
  if (!model) {
    cb.onError("Unknown model.");
    return;
  }
  void import("./providers").then(() => {}).catch(() => {});
  const payload = {
    providerKey,
    apiKey,
    modelId: resolveModelId(model),
    body: {
      model: resolveModelId(model),
      messages: cleanHistory(messages).map((m) => {
        if (m.role === "user") {
          const allImages = [m.image, ...(m.images ?? [])].filter(Boolean);
          if (allImages.length) {
            return {
              role: "user",
              content: [
                { type: "text", text: m.content || (allImages.length > 1 ? "Describe these images" : "Describe this image") },
                ...allImages.map((img) => ({ type: "image_url", image_url: { url: img } })),
              ],
            };
          }
        }
        return { role: m.role, content: m.content };
      }),
      stream: true,
      max_tokens: 2048,
      ...(opts.params?.temperature != null ? { temperature: opts.params.temperature } : {}),
      ...(opts.params?.top_p != null ? { top_p: opts.params.top_p } : {}),
    },
  };
  void modelKey;

  fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: abort.signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        let detail = "";
        try {
          const j = await res.json();
          detail = j?.error?.message || j?.error || j?.message || "";
        } catch {
          detail = res.statusText;
        }
        const msg = detail || `Provider returned ${res.status}`;
        if (isRateLimitError(msg)) recordModelStatus(modelKey, "rate-limited");
        throw new Error(msg);
      }
      recordModelStatus(modelKey, "ok");
      if (!res.body) throw new Error("No response stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let started = false;
      // Inactivity timer — resets on every chunk/activity so slow models
      // are never killed mid-reply. Only a dead connection triggers it.
      let timer: any = 0; // clearTimeout accepts number | Timeout in both envs
      const resetTimer = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          clearTimeout(timer);
          reader.cancel().catch(() => {});
          cb.onError("The model took too long to reply. Try again.");
        }, TIMEOUT_MS);
      };
      resetTimer();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          resetTimer(); // every chunk of activity resets the dead-connection timer
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const t = line.trim();
            if (!t.startsWith("data:")) continue;
            const data = t.slice(5).trim();
            if (data === "[DONE]") {
              clearTimeout(timer);
              recordModelStatus(modelKey, "ok");
              cb.onDone();
              return;
            }
            let ev: any;
            try {
              ev = JSON.parse(data);
            } catch {
              continue;
            }
            const delta = ev?.choices?.[0]?.delta;
            if (!delta) continue;
            started = true;
            const content = delta.content ?? "";
            if (content) cb.onDelta(content);
            const reasoning = delta.reasoning ?? delta.reasoning_content ?? "";
            if (reasoning) cb.onReasoning?.(reasoning);
          }
        }
        if (!started) {
          throw new Error("The model sent no content. This often means a rate limit — wait a moment and retry.");
        }
        recordModelStatus(modelKey, "ok");
        cb.onDone();
      } catch (err) {
        clearTimeout(timer);
        if (abort.signal.aborted) {
          // Abort happened mid-stream (e.g. user pressed stop) — end gracefully.
          cb.onDone();
          return;
        }
        cb.onError(decodeError(err));
      }
    })
    .catch((err) => {
      if (abort.signal.aborted) {
        // User stopped while fetching (before the stream even started) —
        // finalize gracefully instead of a hidden error.
        cb.onDone();
        return;
      }
      if (err instanceof Error && isRateLimitError(err.message)) {
        recordModelStatus(modelKey, "rate-limited");
      }
      cb.onError(decodeError(err));
    });
}

/** Test an API key by asking for a tiny completion (same provider auth rules). */
export async function testApiKey(
  providerKey: ModelDef["provider"],
  apiKey: string,
): Promise<{ ok: boolean; message: string }> {
  const model = getModel("z-ai/glm-5.2");
  if (!model) return { ok: false, message: "No default model" };
  const modelId =
    providerKey === "nvidia"
      ? "z-ai/glm-5.2"
      : providerKey === "mistral"
        ? "mistral-small-latest"
        : providerKey === "groq"
          ? "openai/gpt-oss-120b"
          : providerKey === "openrouter"
            ? "nvidia/nemotron-3-nano-30b-a3b:free"
            : "mimo-v2.5-free";
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      providerKey,
      apiKey,
      modelId,
      body: {
        model: modelId,
        messages: [{ role: "user", content: "Say OK" }],
        stream: false,
        max_tokens: 5,
      },
    }),
  });
  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = j?.error?.message || j?.message || "";
    } catch {
      detail = res.statusText;
    }
    return { ok: false, message: detail || `HTTP ${res.status}` };
  }
  return { ok: true, message: "Key works" };
}

import { PROVIDERS, MODELS, getModel } from "./providers";
import { resolveApiKey } from "./builtin-keys";

export interface ImageAttachment {
  uri: string;
  base64: string;
  width?: number;
  height?: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  text: string;
  image?: ImageAttachment;
}

function builtinBase(providerKey: string): string {
  switch (providerKey) {
    case "gemini":
      return "https://generativelanguage.googleapis.com/v1beta";
    case "nvidia":
      return "https://integrate.api.nvidia.com/v1";
    case "groq":
      return "https://api.groq.com/openai/v1";
    case "cerebras":
      return "https://api.cerebras.ai/v1";
    case "openrouter":
      return "https://openrouter.ai/api/v1";
    case "opencode_zen":
      return "https://opencode.ai/zen/v1";
    default:
      return "https://api.mistral.ai/v1";
  }
}

/**
 * Resolves the provider base URL. Remote (OTA) config overrides the bundled
 * default, so endpoint fixes can be pushed without rebuilding the app.
 */
export async function getBase(providerKey: string): Promise<string> {
  try {
    const remote = await import("./remote-config");
    const remoteBase = await remote.getRemoteBase(providerKey);
    if (remoteBase) return remoteBase;
  } catch {
    // remote config unavailable — fall back to bundled default
  }
  return builtinBase(providerKey);
}

const TIMEOUT_MS = 45_000; // per-request cap; hung providers show a friendly error instead of RN's generic "Network request failed"

async function fetchJson(url: string, init: RequestInit): Promise<Response> {
  const { signal } = init;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const timeoutSignal = new AbortController();
  // Unified signal: whichever fires first (caller cancel or timeout) aborts.
  const combined = () => {
    if (signal?.aborted) timeoutSignal.abort();
    if (timedOut) timeoutSignal.abort();
  };
  signal?.addEventListener?.("abort", combined);
  // Provider-level timeout so a hung server shows a friendly error instead of
  // a generic "Network request failed" after RN's own (very long) default.
  timer = setTimeout(() => {
    timedOut = true;
    timeoutSignal.abort();
  }, TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: timeoutSignal.signal });
    (res as unknown as { _timedOut?: boolean })._timedOut = timedOut;
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function streamOpenAiCompatible(params: {
  providerKey: string;
  apiKey: string;
  modelId: string;
  messages: ChatMessage[];
  image: ImageAttachment | null;
  onToken: (text: string) => void;
  signal: AbortSignal;
}): Promise<string> {
  const { providerKey, apiKey, modelId, messages, image, onToken, signal } = params;
  const base = await getBase(providerKey);
  const url = base + "/chat/completions";

  const apiMessages: { role: string; content: string | unknown[] }[] = [];
  for (const m of messages) {
    if (m.role === "system") {
      apiMessages.push({ role: "system", content: m.text });
      continue;
    }
    const content: unknown[] = [{ type: "text", text: m.text }];
    if (image && m.role === "user") {
      content.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${image.base64}` },
      });
    }
    apiMessages.push({ role: m.role, content: content.length === 1 ? m.text : content });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (providerKey === "openrouter") {
    headers["HTTP-Referer"] = "https://manus.im";
    headers["X-Title"] = "AI Chat";
  }

  const res = await fetchJson(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: modelId,
      messages: apiMessages,
      stream: true,
      max_tokens: 4096,
    }),
    signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`${getProviderLabel(providerKey)} API error ${res.status}: ${errText}`);
  }

  if (!res.body) {
    // Nvidia NIM (and some proxies) occasionally close the connection for
    // third-party hosted models (prefix-404 / empty SSE). Retry once with the
    // leading provider prefix stripped when possible.
    if (providerKey === "nvidia" && modelId.startsWith("nvidia/")) {
      const bare = modelId.slice("nvidia/".length);
      return streamOpenAiCompatible({ ...params, modelId: bare });
    }
    throw new Error(
      `Model "${modelId}" did not respond — the provider's server is overloaded or your connection dropped before the reply started. Wait a minute and retry, or switch to another model.`,
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") return full;
      try {
        const json = JSON.parse(data);
        let delta: unknown = json.choices?.[0]?.delta?.content;
        // OpenCode Zen reasoning-heavy models (e.g. mimo-v2.5-free, deepseek-
        // v4-flash-free) often send null/empty `content` chunks and emit the
        // answer via `delta.reasoning` or `delta.reasoning_content` instead.
        // Falling back to reasoning avoids an empty reply bubble.
        if ((typeof delta !== "string" || !delta) && providerKey === "opencode_zen") {
          delta =
            json.choices?.[0]?.delta?.reasoning ??
            json.choices?.[0]?.delta?.reasoning_content;
        }
        if (typeof delta === "string" && delta) {
          full += delta;
          onToken(delta);
        }
      } catch {
        // skip malformed chunk
      }
    }
  }
  if (!full.trim()) {
    throw new Error(
      `Model "${modelId}" replied but sent no readable text. This usually means the provider is overloaded right now — wait a minute and retry, or switch to another model.`,
    );
  }
  return full;
}

async function streamGemini(params: {
  apiKey: string;
  modelId: string;
  messages: ChatMessage[];
  image: ImageAttachment | null;
  onToken: (text: string) => void;
  signal: AbortSignal;
}): Promise<string> {
  const { apiKey, modelId, messages, image, onToken, signal } = params;
  const base = "https://generativelanguage.googleapis.com/v1beta";
  const url = `${base}/models/${modelId}:streamGenerateContent?key=${encodeURIComponent(apiKey)}&alt=sse`;

  const contents: unknown[] = [];
  let systemInstruction: unknown | undefined;
  for (const m of messages) {
    if (m.role === "system") {
      systemInstruction = { parts: [{ text: m.text }] };
      continue;
    }
    const parts: unknown[] = [];
    if (image && m.role === "user") {
      parts.push({
        inline_data: { mime_type: "image/jpeg", data: image.base64 },
      });
    }
    parts.push({ text: m.text });
    contents.push({ role: m.role === "assistant" ? "model" : "user", parts });
  }

  const body: Record<string, unknown> = { contents };
  if (systemInstruction) body.systemInstruction = systemInstruction;

  const res = await fetchJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Gemini API error ${res.status}: ${errText}`);
  }

  if (!res.body) throw new Error("No response body from Gemini");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) continue;
      try {
        const json = JSON.parse(trimmed.slice(5));
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (typeof text === "string" && text) {
          full += text;
          onToken(text);
        }
      } catch {
        // skip
      }
    }
  }
  return full;
}

export function getProviderLabel(key: string): string {
  return PROVIDERS.find((p) => p.key === key)?.label ?? key;
}

export async function streamChat(params: {
  modelKey: string;
  messages: ChatMessage[];
  image?: ImageAttachment | null;
  onToken: (text: string) => void;
  signal: AbortSignal;
}): Promise<string> {
  const model = getModel(params.modelKey);
  if (!model) throw new Error(`Unknown model: ${params.modelKey}`);
  const apiKey = await resolveApiKey(model.providerKey);
  if (!apiKey) {
    throw new Error(
      `No API key set for ${getProviderLabel(model.providerKey)}. Open Settings (gear icon) and add your key.`,
    );
  }
  if (model.providerKey === "gemini") {
    return streamGemini({
      apiKey,
      modelId: model.id.replace("gemini/", ""),
      messages: params.messages,
      image: params.image ?? null,
      onToken: params.onToken,
      signal: params.signal,
    });
  }
  return streamOpenAiCompatible({
    providerKey: model.providerKey,
    apiKey,
    modelId: model.keepPrefix ? model.id : model.id.slice(model.providerKey.length + 1),
    messages: params.messages,
    image: params.image ?? null,
    onToken: params.onToken,
    signal: params.signal,
  });
}

// ---------------------------------------------------------------------------
// Image generation (NVIDIA — flux-1.1-pro / fal-flux-schnell free tier)
// ---------------------------------------------------------------------------
export interface ImageGenResult {
  base64: string;
  mimeType: string;
}

const NVIDIA_IMAGE_MODELS = [
  "nvidia/flux-1.1-pro",
  "nvidia/fal-flux-schnell",
  "nvidia/seedream-image-40b",
];

export function isNvidiaImageModel(modelKey: string): boolean {
  return NVIDIA_IMAGE_MODELS.includes(modelKey);
}

export async function generateImage(params: {
  modelKey: string;
  prompt: string;
  onProgress?: (stage: string) => void;
  signal?: AbortSignal;
}): Promise<ImageGenResult> {
  const { modelKey, prompt, onProgress, signal } = params;
  const apiKey = await resolveApiKey("nvidia");
  if (!apiKey) throw new Error("No NVIDIA API key set for image generation.");
  const base = await getBase("nvidia");
  onProgress?.("Starting NVIDIA image generation...");
  const res = await fetch(`${base}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelKey.slice("nvidia/".length),
      prompt,
      n: 1,
      size: "1024x1024",
    }),
    signal,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`NVIDIA image API error ${res.status}: ${t.slice(0, 200)}`);
  }
  const json = await res.json();
  const data = json.data?.[0];
  if (!data) throw new Error("No image returned from NVIDIA API");
  if (data.b64_json) {
    return { base64: data.b64_json, mimeType: "image/png" };
  }
  if (data.url) {
    onProgress?.("Downloading generated image...");
    const imgRes = await fetch(data.url, { signal });
    if (!imgRes.ok) throw new Error("Failed to download generated image");
    const buf = await imgRes.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return { base64: btoa(binary), mimeType: "image/png" };
  }
  throw new Error("Unexpected image response format");
}

// ---------------------------------------------------------------------------
// Audio / music generation (NVIDIA)
// ---------------------------------------------------------------------------
export interface AudioGenResult {
  base64: string;
  mimeType: string;
}

const NVIDIA_AUDIO_MODELS = [
  "nvidia/audiocraft-musicgen-large",
  "nvidia/nvidia-audioftmx",
];

export function isNvidiaAudioModel(modelKey: string): boolean {
  return NVIDIA_AUDIO_MODELS.includes(modelKey);
}

export async function generateAudio(params: {
  modelKey: string;
  prompt: string;
  durationSeconds?: number;
  onProgress?: (stage: string) => void;
  signal?: AbortSignal;
}): Promise<AudioGenResult> {
  const { modelKey, prompt, durationSeconds = 10, onProgress, signal } = params;
  const apiKey = await resolveApiKey("nvidia");
  if (!apiKey) throw new Error("No NVIDIA API key set for audio generation.");
  const base = await getBase("nvidia");
  onProgress?.("Starting NVIDIA audio generation (may take up to a minute)...");
  const res = await fetch(`${base}/audio-generation/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelKey.slice("nvidia/".length),
      prompts: [prompt],
      duration: durationSeconds,
    }),
    signal,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`NVIDIA audio API error ${res.status}: ${t.slice(0, 200)}`);
  }
  const json = await res.json();
  const audio = json.audio?.[0];
  if (!audio) throw new Error("No audio returned from NVIDIA API");
  if (audio.b64_json) {
    return { base64: audio.b64_json, mimeType: audio.mime_type ?? "audio/mpeg" };
  }
  if (audio.url) {
    onProgress?.("Downloading generated audio...");
    const aRes = await fetch(audio.url, { signal });
    if (!aRes.ok) throw new Error("Failed to download generated audio");
    const buf = await aRes.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return { base64: btoa(binary), mimeType: "audio/mpeg" };
  }
  throw new Error("Unexpected audio response format");
}

// ---------------------------------------------------------------------------
// PDF text extraction (pure JS, no native deps)
// ---------------------------------------------------------------------------
export async function extractPdfText(params: { uri: string }): Promise<string> {
  const { uri } = params;
  let pdfjsLib: any;
  try {
    const pdfModule = await import("pdfjs-dist");
    pdfjsLib = pdfModule.default ?? pdfModule;
  } catch {
    throw new Error("PDF reader not available. Install pdfjs-dist.");
  }
  if (typeof pdfjsLib.GlobalWorkerOptions !== "undefined") {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
  }
  let resp: Response;
  if (uri.startsWith("data:") || uri.startsWith("file://") || uri.startsWith("http")) {
    resp = await fetch(uri);
  } else {
    resp = await fetch(uri);
  }
  if (!resp.ok) throw new Error(`Could not load PDF (${resp.status})`);
  const buffer = await resp.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  let text = "";
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => (item.str ?? ""))
      .join(" ")
      .replace(/\s+/g, " ");
    text += `--- Page ${p} ---\n${pageText}\n\n`;
  }
  return text.trim();
}

// ---------------------------------------------------------------------------
// Screenshot / design to code (uses a vision model + structured system prompt)
// ---------------------------------------------------------------------------
export function getScreenshotToCodePrompt(): string {
  return [
    "You are an expert frontend engineer. The attached image is a UI design or screenshot.",
    "Recreate it as a single self-contained HTML file with inline CSS and JS (no external assets except CDNs).",
    "Match layout, colors, typography, spacing, and content as closely as possible.",
    "Return ONLY the HTML code inside a single markdown code block. No explanations before or after.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Helper: system prompts for specialized modes
// ---------------------------------------------------------------------------
export function getTranslationPrompt(targetLanguage: string): string {
  return `You are a professional translator into ${targetLanguage}. Translate the user's message accurately and naturally. Keep formatting. If asked, briefly note nuances. Do not add commentary unless requested.`;
}

export function getMathSolverPrompt(): string {
  return [
    "You are an expert math tutor. Solve the user's problem step by step.",
    "Show your reasoning clearly, then state the final answer.",
    "Write all equations as LaTeX inside $$...$$ (block) or $...$ (inline) so the app can render them.",
  ].join("\n");
}

export function getDeepResearchPrompt(): string {
  return [
    "You are a deep research analyst. When the user gives you a research topic:",
    "1. Identify what must be researched (key questions, sub-topics).",
    "2. Systematically investigate each aspect, covering facts, figures, and context.",
    "3. Structure your final report with clear headings: Overview, Key Findings, Analysis, Sources/Notes.",
    "4. Be thorough but honest about what you can and cannot verify.",
    "Write in markdown with tables where useful.",
  ].join("\n");
}

export function getThinkingPrompt(): string {
  return [
    "Before answering, reason step by step inside <thinking> tags:",
    "- Restate the problem",
    "- List assumptions and relevant knowledge",
    "- Reason through the answer",
    "- Verify your conclusion",
    "After closing </thinking>, give the user a clear, polished final answer without the reasoning.",
  ].join("\n");
}

export async function testApiKey(providerKey: string, apiKey: string): Promise<{ ok: boolean; message: string }> {
  const model = MODELS.find((m) => m.providerKey === providerKey);
  if (!model) return { ok: false, message: "Unknown provider" };
  const base = await getBase(providerKey);

  try {
    if (providerKey === "gemini") {
      const res = await fetch(
        `${base}/models/${model.id.replace("gemini/", "")}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "Say OK" }] }],
            generationConfig: { maxOutputTokens: 10 },
          }),
        },
      );
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        return { ok: false, message: decodeGeminiError(res.status, t) };
      }
      return { ok: true, message: "Key is working!" };
    }
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model.keepPrefix ? model.id : model.id.slice(providerKey.length + 1),
        messages: [{ role: "user", content: "Say OK" }],
        max_tokens: 10,
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, message: decodeOpenAIStyleError(res.status, t) };
    }
    return { ok: true, message: "Key is working!" };
  } catch (e) {
    return { ok: false, message: `Network error: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * Normalize raw native fetch errors. React Native's fetch throws a TypeError
 * with message "Network request failed" for hung/unreachable servers — surface
 * a friendly hint instead of the raw message.
 */
export function normalizeNetworkError(raw: unknown, providerKey?: string): string {
  const text = raw instanceof Error ? raw.message : String(raw);
  if (/Network request failed/i.test(text)) {
    const label = providerKey ? getProviderLabel(providerKey) : "provider";
    return `Could not reach ${label} — the server is hanging or your connection is off. Try another model or check your internet and retry.`;
  }
  return text;
}

/** Human-friendly decoding for OpenAI-style (Nvidia/Groq/Cerebras/Mistral/OpenRouter/Zen) errors. */
function decodeOpenAIStyleError(status: number, body: string): string {
  const code = extractErrorCode(body);
  if (status === 401) return "Invalid API key — check the key and try again.";
  if (status === 402) return `Your key has run out of free usage (quota exceeded${code ? `: ${code}` : ""}). Add a new key or use another provider.`;
  if (status === 403) return `Access denied — this key was revoked or blocked${code ? ` (${code})` : ""}. Create a new key.`;
  if (status === 404) return `Model not available${code ? ` (${code})` : ""}. Pick a different model.`;
  if (status === 429) return "Too many requests — the provider rate-limited this key. Wait a bit and retry.";
  if (status >= 500) return "The provider's servers are down — retry later or pick another provider.";
  return `API error ${status}${code ? ` (${code})` : ""} — ${body.slice(0, 120)}`;
}

/** Human-friendly decoding for Gemini errors. */
function decodeGeminiError(status: number, body: string): string {
  const code = extractErrorCode(body);
  if (status === 400) return `Invalid request${code ? ` (${code})` : ""} — ${body.slice(0, 120)}`;
  if (status === 403) return "Access denied — this Gemini key was revoked or blocked. Create a new key in Google AI Studio.";
  if (status === 404) return `Model not available${code ? ` (${code})` : ""} — pick a different model.`;
  if (status === 429) return "Rate limited — Gemini throttled this key. Wait and retry.";
  return `API error ${status}${code ? ` (${code})` : ""} — ${body.slice(0, 120)}`;
}

/** Extract Google error codes like PERMISSION_DENIED / QUOTA_EXCEEDED / INVALID_ARGUMENT from body. */
function extractErrorCode(body: string): string {
  const m = body.match(/"code"\s*:\s*"([A-Z_]+)"/);
  return m ? m[1] : "";
}

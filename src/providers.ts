import type { CustomModelDef } from "./storage";

// Verified working models (live-tested 2026-08-18).
// Open-source site: NO built-in keys — every user brings their own API keys.

export const PROVIDER_LABELS: Record<ProviderKey, string> = {
  nvidia: "Nvidia",
  mistral: "Mistral",
  groq: "Groq",
  openrouter: "OpenRouter",
  opencode: "OpenCode Zen",
  gemini: "Gemini",
};

export type ProviderKey = "nvidia" | "mistral" | "groq" | "openrouter" | "opencode" | "gemini";

export interface ModelDef {
  key: string;
  label: string;
  provider: ProviderKey;
  vision?: boolean;
  /** When true, send the full catalog id (e.g. nvidia's Nemotron Nano VL) */
  keepPrefix?: boolean;
}

export const PROVIDERS: Record<
  ProviderKey,
  {
    label: string;
    url: string;
    /** header name for auth; value = "Bearer " + key */
    header: string;
    /** env name of built-in hidden key (server exposes these) */
    envKey: string;
    /** true when the server actually ships this provider's key — UI shows models as available */
    hasBuiltInKey?: boolean;
    modelPrefix: string;
    bareId?: boolean;
  }
> = {
  nvidia: {
    label: "Nvidia",
    url: "https://integrate.api.nvidia.com/v1",
    header: "Authorization",
    envKey: "",
    hasBuiltInKey: false,
    modelPrefix: "nvidia/",
  },
  mistral: {
    label: "Mistral",
    url: "https://api.mistral.ai/v1",
    header: "Authorization",
    envKey: "",
    hasBuiltInKey: false,
    modelPrefix: "mistral/",
    bareId: true,
  },
  groq: {
    label: "Groq",
    url: "https://api.groq.com/openai/v1",
    header: "Authorization",
    envKey: "",
    hasBuiltInKey: false,
    modelPrefix: "groq/",
    bareId: true,
  },
  openrouter: {
    label: "OpenRouter",
    url: "https://openrouter.ai/api/v1",
    header: "Authorization",
    envKey: "",
    hasBuiltInKey: false,
    modelPrefix: "openrouter/",
    bareId: true,
  },
  opencode: {
    label: "OpenCode Zen",
    url: "https://opencode.ai/zen/v1",
    header: "Authorization",
    envKey: "",
    hasBuiltInKey: false,
    modelPrefix: "opencode/",
    bareId: true,
  },
  gemini: {
    label: "Gemini",
    url: "https://generativelanguage.googleapis.com/v1beta",
    header: "Authorization",
    envKey: "",
    hasBuiltInKey: false,
    modelPrefix: "gemini/",
  },
};

// Live-verified slugs.
// Nvidia NIM: send BARE id, except Nemotron Nano VL which needs the full catalog id.
// Mistral/Groq/OpenRouter: BARE ids sent to the API (provider prefix stripped from key).
export const MODELS: ModelDef[] = [
  // Nvidia (5)
  { key: "z-ai/glm-5.2", label: "GLM 5.2", provider: "nvidia" },
  { key: "openai/gpt-oss-20b", label: "GPT-OSS 20B", provider: "nvidia" },
  // MiniMax M3: catalogue says vision-capable but Nvidia's server is currently DOWN for this model (502, provider outage — not an app bug).
  { key: "minimaxai/minimax-m3", label: "MiniMax M3", provider: "nvidia", vision: true },
  { key: "nvidia/llama-3.1-nemotron-nano-vl-8b-v1", label: "Nemotron Nano VL 8B", provider: "nvidia", vision: true, keepPrefix: true },
  { key: "meta/llama-3.3-70b-instruct", label: "Llama 3.3 70B", provider: "nvidia" },
  // Mistral (2) — bare ids. Only free-tier models: codestral & nemo need paid plans.
  { key: "mistral/mistral-small-latest", label: "Mistral Small", provider: "mistral" },
  { key: "mistral/mistral-medium-latest", label: "Mistral Medium", provider: "mistral" },
  // Groq (3) — bare ids
  { key: "groq/openai/gpt-oss-120b", label: "GPT-OSS 120B", provider: "groq" },
  { key: "groq/openai/gpt-oss-20b", label: "GPT-OSS 20B", provider: "groq" },
  { key: "qwen/qwen3.6-27b", label: "Qwen 3.6 27B", provider: "groq" },
  // OpenRouter (4) — full ids
  { key: "openrouter/nvidia/nemotron-3-nano-30b-a3b:free", label: "Nemotron 3 Nano 30B", provider: "openrouter" },
  { key: "openrouter/nvidia/nemotron-nano-12b-v2-vl:free", label: "Nemotron Nano 12B VL", provider: "openrouter", vision: true },
  { key: "openrouter/z-ai/glm-5.2:free", label: "GLM 5.2 (Free)", provider: "openrouter" },
  { key: "openrouter/google/gemma-4-26b-a4b-it:free", label: "Gemma 4 26B (Free)", provider: "openrouter", vision: true },
  // OpenCode Zen (5) — DeepSeek V4 family from the user's Instagram reel.
  // deepseek-v4-pro & deepseek-v4-flash removed: paid-only, return 401 on the free key (live-tested 2026-08-19).
  { key: "opencode/deepseek-v4-flash-free", label: "DeepSeek V4 Flash Free", provider: "opencode" },
  { key: "opencode/mimo-v2.5-free", label: "MiMo 2.5 Free", provider: "opencode", vision: true },
  { key: "opencode/nemotron-3.5-lightning-free", label: "Nemotron 3.5 Lightning Free", provider: "opencode" },
  { key: "opencode/hy3-free", label: "Hy3 Free", provider: "opencode" },
  { key: "opencode/nemotron-3-ultra-free", label: "Nemotron 3 Ultra Free", provider: "opencode" },
  // Gemini — Google AI Studio free-tier models (vision-capable)
  { key: "gemini/gemini-3.5-flash-lite", label: "Gemini 3.5 Flash Lite", provider: "gemini", vision: true },
];

/** Map provider-specific model key → id sent to the API */
export function resolveModelId(model: ModelDef): string {
  const p = PROVIDERS[model.provider];
  if (model.keepPrefix) return model.key;
  if (p.bareId) {
    // strip the provider prefix (mistral/mistral-small-latest -> mistral-small-latest)
    const prefix = `${model.provider}/`;
    return model.key.startsWith(prefix) ? model.key.slice(prefix.length) : model.key;
  }
  return model.key;
}

export function getModel(key: string): ModelDef | undefined {
  return ALL_MODELS().find((m) => m.key === key);
}

/** Built-in + user-added custom models (custom models come from settings). */
export function ALL_MODELS(): ModelDef[] {
  try {
    const raw = localStorage.getItem("asky.settings");
    if (raw) {
      const s = JSON.parse(raw);
      const customs = (s?.customModels ?? []) as CustomModelDef[];
      const valid = customs.filter((c) => c?.enabled !== false && c?.modelId);
      if (valid.length) {
        return [
          ...MODELS,
          ...valid.map((c) => ({
            key: `custom/${c.id}`,
            label: c.label || c.modelId,
            provider: c.provider as ProviderKey,
            vision: Boolean(c.vision),
            keepPrefix: false,
          })),
        ];
      }
    }
  } catch {
    /* ignore malformed settings */
  }
  return MODELS;
}

/** Invalidate any memoized copy of the model catalog (custom model added/removed). */
let catalogVersion = 0;
export function invalidateCustomModels() {
  catalogVersion += 1;
  return catalogVersion;
}
export function getCatalogVersion() {
  return catalogVersion;
}

export const DEFAULT_MODEL_KEY = "z-ai/glm-5.2";

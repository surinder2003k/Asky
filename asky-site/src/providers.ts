// Verified working models (live-tested 2026-08-18).
// Open-source site: NO built-in keys — every user brings their own API keys.

export type ProviderKey = "nvidia" | "mistral" | "groq" | "openrouter" | "opencode";

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
};

// Live-verified slugs.
// Nvidia NIM: send BARE id, except Nemotron Nano VL which needs the full catalog id.
// Mistral/Groq/OpenRouter: BARE ids sent to the API (provider prefix stripped from key).
export const MODELS: ModelDef[] = [
  // Nvidia (5)
  { key: "z-ai/glm-5.2", label: "GLM 5.2", provider: "nvidia" },
  { key: "openai/gpt-oss-20b", label: "GPT-OSS 20B", provider: "nvidia" },
  { key: "minimaxai/minimax-m3", label: "MiniMax M3", provider: "nvidia", vision: true },
  { key: "nvidia/llama-3.1-nemotron-nano-vl-8b-v1", label: "Nemotron Nano VL 8B", provider: "nvidia", vision: true, keepPrefix: true },
  { key: "meta/llama-3.3-70b-instruct", label: "Llama 3.3 70B", provider: "nvidia" },
  // Mistral (2) — bare ids. Only free-tier models: codestral & nemo need paid plans.
  { key: "mistral/mistral-small-latest", label: "Mistral Small", provider: "mistral" },
  { key: "mistral/mistral-medium-latest", label: "Mistral Medium", provider: "mistral" },
  // Groq (3) — Groq API requires the full id (bare slugs were retired), so keep the prefix.
  { key: "groq/openai/gpt-oss-120b", label: "GPT-OSS 120B", provider: "groq", keepPrefix: true },
  { key: "groq/openai/gpt-oss-20b", label: "GPT-OSS 20B", provider: "groq", keepPrefix: true },
  { key: "groq/qwen/qwen3.6-27b", label: "Qwen 3.6 27B", provider: "groq", keepPrefix: true },
  // OpenRouter (4) — full ids
  { key: "openrouter/nvidia/nemotron-3-nano-30b-a3b:free", label: "Nemotron 3 Nano 30B", provider: "openrouter" },
  { key: "openrouter/nvidia/nemotron-nano-12b-v2-vl:free", label: "Nemotron Nano 12B VL", provider: "openrouter", vision: true },
  { key: "openrouter/z-ai/glm-5.2:free", label: "GLM 5.2 (Free)", provider: "openrouter" },
  { key: "openrouter/google/gemma-4-26b-a4b-it:free", label: "Gemma 4 26B (Free)", provider: "openrouter", vision: true },
  // OpenCode Zen (5) — free models only (account has no billing, paid models rejected)
  { key: "opencode/mimo-v2.5-free", label: "MiMo 2.5 Free", provider: "opencode", vision: true },
  { key: "opencode/deepseek-v4-flash-free", label: "DeepSeek V4 Flash Free", provider: "opencode" },
  { key: "opencode/nemotron-3.5-lightning-free", label: "Nemotron 3.5 Lightning Free", provider: "opencode" },
  { key: "opencode/hy3-free", label: "Hy3 Free", provider: "opencode" },
  { key: "opencode/nemotron-3-ultra-free", label: "Nemotron 3 Ultra Free", provider: "opencode" },
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
  return MODELS.find((m) => m.key === key);
}

export const DEFAULT_MODEL_KEY = "z-ai/glm-5.2";

export interface Provider {
  key: string;
  label: string;
  inputLabel: string;
  placeholder: string;
}

export interface ModelDef {
  id: string; // provider/model-id
  name: string;
  providerKey: string;
  vision: boolean;
  /** If true, the API slug keeps the full model id (Nvidia catalog ids like nvidia/llama-3.1-nemotron-nano-vl-8b-v1 need the prefix). */
  keepPrefix?: boolean;
}

export const PROVIDERS: Provider[] = [
  {
    key: "gemini",
    label: "Google Gemini",
    inputLabel: "Google Gemini",
    placeholder: "Paste Google Gemini API key",
  },
  {
    key: "groq",
    label: "Groq",
    inputLabel: "Groq",
    placeholder: "Paste Groq API key",
  },
  {
    key: "mistral",
    label: "Mistral",
    inputLabel: "Mistral",
    placeholder: "Paste Mistral API key",
  },
  {
    key: "nvidia",
    label: "Nvidia NIM",
    inputLabel: "Nvidia NIM",
    placeholder: "Paste Nvidia NIM API key",
  },
  {
    key: "openrouter",
    label: "OpenRouter",
    inputLabel: "OpenRouter",
    placeholder: "Paste OpenRouter API key",
  },
  {
    key: "cerebras",
    label: "Cerebras",
    inputLabel: "Cerebras",
    placeholder: "Paste Cerebras API key",
  },
  {
    key: "opencode_zen",
    label: "OpenCode Zen",
    inputLabel: "OpenCode Zen",
    placeholder: "Paste OpenCode Zen API key",
  },
];

export const MODELS: ModelDef[] = [
  // Google Gemini — removed: the user's Gemini project is denied access server-side
  // (all IDs return HTTP 403 PERMISSION_DENIED, verified Aug 2026). Users with a
  // working Gemini project can still add the key; the provider entry stays.
  // Groq
  { id: "groq/llama-3.1-8b-instant", name: "Llama 3.1 8B", providerKey: "groq", vision: false },
  { id: "groq/llama-3.3-70b-versatile", name: "Llama 3.3 70B", providerKey: "groq", vision: false },
  { id: "groq/openai/gpt-oss-120b", name: "GPT-OSS 120B", providerKey: "groq", vision: false },
  { id: "groq/openai/gpt-oss-20b", name: "GPT-OSS 20B", providerKey: "groq", vision: false },
  { id: "groq/groq/compound", name: "Groq Compound (web search + code)", providerKey: "groq", vision: false },
  { id: "groq/groq/compound-mini", name: "Groq Compound Mini", providerKey: "groq", vision: false },
  // Mistral
  { id: "mistral/mistral-small-latest", name: "Mistral Small", providerKey: "mistral", vision: false },
  { id: "mistral/ministral-3b-latest", name: "Ministral 3B", providerKey: "mistral", vision: false },
  { id: "mistral/ministral-8b-latest", name: "Ministral 8B", providerKey: "mistral", vision: false },
  { id: "mistral/magistral-small-latest", name: "Magistral Small", providerKey: "mistral", vision: false },
  { id: "mistral/pixtral-12b-2409", name: "Pixtral 12B", providerKey: "mistral", vision: true },
  { id: "mistral/pixtral-large-latest", name: "Pixtral Large", providerKey: "mistral", vision: true },
  // Nvidia NIM — verified live Aug 2026: endpoint 404s for 'google/glm-5.2',
  // 'nvidia/z-ai/glm-5.2' AND 'z-ai/glm-5.2'?? — actual working ids are the bare
  // catalog ids WITHOUT the 'nvidia/' prefix: 'z-ai/glm-5.2',
  // 'minimaxai/minimax-m3', 'meta/llama-3.2-11b-vision-instruct'.
  // (Note: modelSlugOnly already strips the leading 'nvidia/' segment, so these
  // ids arrive at the API as z-ai/glm-5.2 etc.)
  { id: "nvidia/z-ai/glm-5.2", name: "GLM 5.2", providerKey: "nvidia", vision: false },
  { id: "nvidia/openai/gpt-oss-20b", name: "GPT-OSS 20B", providerKey: "nvidia", vision: false },
  { id: "nvidia/minimaxai/minimax-m3", name: "MiniMax M3", providerKey: "nvidia", vision: false },
  { id: "nvidia/meta/llama-3.2-11b-vision-instruct", name: "Llama 3.2 11B Vision", providerKey: "nvidia", vision: true },
  { id: "nvidia/llama-3.1-nemotron-nano-vl-8b-v1", name: "Nemotron Nano VL 8B", providerKey: "nvidia", vision: true, keepPrefix: true },
  // OpenRouter
  { id: "openrouter/google/gemini-2.5-flash", name: "Gemini 2.5 Flash", providerKey: "openrouter", vision: true },
  { id: "openrouter/google/gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", providerKey: "openrouter", vision: true },
  { id: "openrouter/google/gemini-2.5-pro", name: "Gemini 2.5 Pro", providerKey: "openrouter", vision: true },
  { id: "openrouter/openai/gpt-oss-120b", name: "GPT-OSS 120B", providerKey: "openrouter", vision: false },
  { id: "openrouter/anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5", providerKey: "openrouter", vision: true },
  { id: "openrouter/openai/gpt-5-mini", name: "GPT-5 Mini", providerKey: "openrouter", vision: false },
  { id: "openrouter/qwen/qwen3-8b", name: "Qwen 3 8B", providerKey: "openrouter", vision: false },
  { id: "openrouter/openrouter/free", name: "Auto Free", providerKey: "openrouter", vision: false },
  // OpenRouter extra free models (Aug 2026)
  { id: "openrouter/nvidia/nemotron-nano-omni-30b-a3b-reasoning:free", name: "Nemotron Nano Omni 30B (Free)", providerKey: "openrouter", vision: true },
  { id: "openrouter/nvidia/nemotron-nano-12b-v2-vl:free", name: "Nemotron Nano 12B 2 VL (Free)", providerKey: "openrouter", vision: true },
  { id: "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free", name: "Nemotron 3 Ultra 550B (Free)", providerKey: "openrouter", vision: false },
  { id: "openrouter/nvidia/nemotron-3-super-120b-a12b:free", name: "Nemotron 3 Super 120B (Free)", providerKey: "openrouter", vision: false },
  { id: "openrouter/poolside/laguna-xs-2.1:free", name: "Laguna XS 2.1 (Free)", providerKey: "openrouter", vision: false },
  { id: "openrouter/nvidia/nemotron-3.5-lightning:free", name: "Nemotron 3.5 Lightning (Free)", providerKey: "openrouter", vision: false },
  { id: "openrouter/nvidia/nemotron-3-nano-30b-a3b:free", name: "Nemotron 3 Nano 30B (Free)", providerKey: "openrouter", vision: false },
  { id: "openrouter/liquid/lfm-2.5-2.6b:free", name: "LFM 2.5 2.6B (Free)", providerKey: "openrouter", vision: false },
  { id: "openrouter/nvidia/nemotron-nano-9b-v2:free", name: "Nemotron Nano 9B V2 (Free)", providerKey: "openrouter", vision: false },
  // Cerebras — removed: free tier returns HTTP 402 (quota exhausted) and the
  // older slugs 404 (verified Aug 2026). Provider entry stays for future keys.
  // OpenCode Zen — verified FREE tier only (Aug 2026); paid slugs fail 401 CreditsError
  { id: "opencode_zen/mimo-v2.5-free", name: "MiMo V2.5 Free (Vision + Reasoning)", providerKey: "opencode_zen", vision: true },
  { id: "opencode_zen/deepseek-v4-flash-free", name: "DeepSeek V4 Flash Free", providerKey: "opencode_zen", vision: false },
  { id: "opencode_zen/nemotron-3-ultra-free", name: "Nemotron 3 Ultra Free", providerKey: "opencode_zen", vision: false },
  { id: "opencode_zen/nemotron-3.5-lightning-free", name: "Nemotron 3.5 Lightning Free", providerKey: "opencode_zen", vision: false },
  { id: "opencode_zen/laguna-s-2.1-free", name: "Laguna S 2.1 Free", providerKey: "opencode_zen", vision: false },
  { id: "opencode_zen/hy3-free", name: "HY3 Free", providerKey: "opencode_zen", vision: false },
];

// Default model: Mistral works reliably; user's Gemini key has project-level restriction (403).
export const DEFAULT_MODEL_KEY = "mistral/mistral-small-latest";

// The authoritative model list may be overridden at runtime by the hosted remote config
// (see lib/remote-config.ts). Use getEffectiveModels() when the latest list matters.
export async function getEffectiveModels(): Promise<ModelDef[]> {
  const { getModels } = await import("./remote-config");
  return getModels();
}

export async function getEffectiveDefaultModelKey(): Promise<string> {
  const { getDefaultModelKey } = await import("./remote-config");
  return getDefaultModelKey();
}

export function resolveModel(providerKey: string, modelId: string): { provider: Provider; model: ModelDef } | null {
  const model = MODELS.find((m) => m.id === `${providerKey}/${modelId}`);
  if (!model) return null;
  const provider = PROVIDERS.find((p) => p.key === providerKey);
  if (!provider) return null;
  return { provider, model };
}

export function getModel(key: string): ModelDef | null {
  return MODELS.find((m) => m.id === key) ?? null;
}

/**
 * Short human-readable source label for a model key, e.g. "Mistral Small · Mistral".
 * Falls back to the raw key when the model is not in the catalog (e.g. remote-config
 * models that exist at runtime only).
 */
export function getModelSourceLabel(modelKey: string): string {
  const model = getModel(modelKey);
  if (!model) return modelKey;
  const provider = PROVIDERS.find((p) => p.key === model.providerKey);
  return `${model.name} · ${provider?.label ?? model.providerKey}`;
}

/**
 * Strip the provider prefix from a model key, matching what the streaming
 * client sends to the API (Nvidia third-party models must not carry 'nvidia/').
 * Kept in sync with the client-side prefix stripping in lib/ai.ts.
 */
export function modelSlugOnly(modelKey: string): string {
  const idx = modelKey.indexOf("/");
  return idx === -1 ? modelKey : modelKey.slice(idx + 1);
}

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { getApiBaseUrl } from "@/constants/oauth";
import { DEFAULT_MODEL_KEY, MODELS as BUILTIN_MODELS, type ModelDef } from "./providers";

// Remote config — the app fetches this from its own built-in server endpoint (/api/trpc/remoteConfig.get),
// which proxies the hosted JSON. This avoids CDN CORS issues and lets the endpoint be repointed
// via the REMOTE_CONFIG_URL server env var without rebuilding the app.
// Resolve against the API server (not the Metro web origin, where `/api` serves the app bundle).
// On web dev: 8081 -> 3000 hostname swap is handled by getApiBaseUrl(); on native the API base
// is the gateway URL; after publishing, getApiBaseUrl() returns the production API origin.
export function getConfigUrl(): string {
  const base = getApiBaseUrl().replace(/\/$/, "");
  return `${base}/api/trpc/remoteConfig.get`;
}
export const REMOTE_CONFIG_URL = getConfigUrl();

const STORAGE_KEY = "aic_app:remoteConfig";
const VERSION_KEY = "aic_app:remoteConfigVersion";

export interface RemoteConfig {
  version: string;
  models: ModelDef[];
  providerBases: Record<string, string>;
  defaultModelKey?: string;
}

function isValidConfig(data: unknown): data is RemoteConfig {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.models) || !d.models.length) return false;
  if (!d.models.every((m: unknown) => m && typeof m === "object" && (m as ModelDef).id && (m as ModelDef).providerKey)) {
    return false;
  }
  if (!d.providerBases || typeof d.providerBases !== "object") return false;
  return true;
}

export async function getCachedRemoteConfig(): Promise<RemoteConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isValidConfig(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function getCachedVersion(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(VERSION_KEY);
  } catch {
    return null;
  }
}

/**
 * Fetch the hosted config, apply it if it's newer, and persist it.
 * Returns { applied, version, error }.
 */
export async function checkForUpdates(): Promise<{ applied: boolean; version: string | null; error?: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(getConfigUrl(), { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return { applied: false, version: null, error: `HTTP ${res.status}` };
    // tRPC endpoint wraps the result in a superjson envelope: { result: { data: { json: ... } } }
    const envelope = await res.json();
    const data = envelope?.result?.data?.json ?? envelope;
    if (!isValidConfig(data)) return { applied: false, version: null, error: "Invalid config format" };

    const current = await getCachedVersion();
    if (current === data.version) return { applied: false, version: data.version };

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    await AsyncStorage.setItem(VERSION_KEY, String(data.version));
    return { applied: true, version: data.version };
  } catch (e) {
    return { applied: false, version: null, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Effective model list: remote config overrides bundled models entirely (the hosted
 * JSON is the source of truth); falls back to bundled list when remote is unavailable.
 */
export async function getModels(): Promise<ModelDef[]> {
  const remote = await getCachedRemoteConfig();
  return remote?.models ?? BUILTIN_MODELS;
}

/**
 * Effective provider base URL: remote overrides win.
 */
export async function getRemoteBase(providerKey: string): Promise<string | null> {
  const remote = await getCachedRemoteConfig();
  return remote?.providerBases[providerKey] ?? null;
}

export async function getDefaultModelKey(): Promise<string> {
  const remote = await getCachedRemoteConfig();
  const remoteDefault = remote?.defaultModelKey;
  if (remoteDefault) return remoteDefault;
  return DEFAULT_MODEL_KEY;
}

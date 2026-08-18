# Live API key test results (2026-08-14)

Test script: /tmp/test-keys.mjs (rerun anytime).

## CONFIRMED live test results (2026-08-14, full requests)
| Provider | Verdict |
|---|---|
| nvidia | WORKS with slug `meta/llama-3.1-8b-instruct`. Built-in key valid. Vision models: meta/llama-3.2-11b-vision-instruct, meta/llama-3.2-90b-vision-instruct, microsoft/phi-3-vision-128k-instruct, google/gemma-3-12b-it |
| groq | WORKS (llama-3.3-70b-versatile). Models: llama-3.3-70b-versatile, llama-3.1-8b-instant, gpt-oss-120b, gpt-oss-20b, qwen3.6-27b, groq/compound |
| mistral | WORKS (open-mistral-nemo) |
| openrouter | WORKS with `nvidia/nemotron-3.5-lightning:free` (HTTP 200). llama-3.1-8b-instruct:free now paid-only |
| cerebras | KEY QUOTA EXHAUSTED — 402 payment_required even with valid models (gemma-4-31b, zai-glm-4.7, gpt-oss-120b). Current cerebras catalog is only 3 models |
| gemini | PROJECT DENIED — 403 PERMISSION_DENIED on ALL models (key revoked/denied). Live generateContent models: gemini-3.6-flash, gemini-3.7-flash, gemini-3.5-flash, gemini-2.5-flash-lite, gemini-3.1-flash-lite. User must regenerate key in Google AI Studio |
| opencode_zen | KEY CREDITS EXHAUSTED — CreditsError "No payment method" (valid key, no credits). Live zen slugs: gemini-3.6-flash, gemini-3.7-flash, gpt-5.6-luna, gpt-5.6-terra, gpt-5.5, grok-4.6, claude-opus-5 etc.

## Stale model slugs currently in lib/providers.ts (must update)
- nvidia: `nvidia/llama-3.1-8b-instruct` → `meta/llama-3.1-8b-instruct`
- gemini: `gemini-2.0-flash` → `gemini-3.6-flash` / `gemini-3.7-flash`
- cerebras: `llama3.1-8b` → `zai-glm-4.7` / `gemma-4-31b` / `gpt-oss-120b` (old slugs dead)
- opencode_zen: `opencodeai/zen-1-mini` → `gemini-3.6-flash`, `gpt-5.6-luna` etc.
- openrouter: llama-3.1-8b-instruct:free now paid → use `nvidia/nemotron-3.5-lightning:free`

## Old notes

| Provider | Key status | Notes |
|---|---|---|
| nvidia | KEY VALID (404 earlier was wrong slug `nvidia/llama-3.1-8b-instruct`; correct slug is `meta/llama-3.1-8b-instruct` per live model list) | Built-in key works; image gen models flux/fal still valid; vision models: meta/llama-3.2-11b-vision-instruct, meta/llama-3.2-90b-vision-instruct, microsoft/phi-3-vision-128k-instruct, google/gemma-3-12b-it |
| gemini | KEY DENIED 403 (earlier test) + gemini-2.0-flash retired (404); use gemini-2.5-flash etc. User's Gemini key was revoked (PERMISSION_DENIED) | Live models: gemini-2.5-flash, gemini-2.5-pro, gemini-3-flash etc. (fetch models/ endpoint for current list) |
| groq | WORKING 200 | Models: llama-3.3-70b-versatile, llama-3.1-8b-instant, gpt-oss-120b, gpt-oss-20b, qwen3.6-27b, groq/compound, openai/gpt-oss-120b. NO "super/ultra" named models exist (user asked earlier — they don't) |
| cerebras | KEY VALID (404 earlier was stale slug llama3.1-8b). Current cerebras models: zai-glm-4.7, gemma-4-31b, gpt-oss-120b ONLY (their catalog shrunk to 3!) | User's 402 "quota" error earlier likely stale; retest with gemma-4-31b |
| mistral | WORKING 200 | Default model `open-mistral-nemo` still valid (responded as ministral-8b-2512) |
| openrouter | KEY VALID (404 earlier = the :free slug meta-llama/llama-3.1-8b-instruct:free now paid-only; error says use slug `meta-llama/llama-3.1-8b-instruct` paid). Free models now: nvidia/nemotron-3.5-lightning:free, liquid/lfm-2.5-2.6b:free, poolside/laguna-s-2.1:free | User's 402 quota error earlier may also be stale |
| opencode_zen | KEY VALID (401 earlier = stale model slug opencodeai/zen-1-mini). Current zen models: gemini-3.6-flash, gemini-3.7-flash, gpt-5.6-luna, grok-4.6, claude-opus-5, gemini-3.5-flash, gemini-3.1-pro, gpt-5.5, grok-build-0.1 etc. (see full list from models endpoint) | NOTE: zen endpoints host OpenAI-style slugs (gpt-*, claude-*, grok-*, gemini-*) — NOT real APIs; user knows/uses this |

## Required app fixes from these findings
1. Update MODELS list in lib/providers.ts with current live slugs (nvidia meta/llama-3.1-8b-instruct, gemini-2.5-flash, cerebras zai-glm-4.7/gemma-4-31b/gpt-oss-120b, openrouter free models, zen current slugs)
2. testApiKey in lib/ai.ts: use a known-good model per provider (not just first MODELS entry) and decode friendly errors (402→quota exhausted; 403→access denied; 404→model not available; 401→invalid key)
3. keyAvailability must include built-in keys (hasUsableKey from lib/builtin-keys.ts)
4. Built-in Nvidia key in lib/builtin-keys.ts — resolveApiKey used everywhere instead of getApiKey (chat, image gen, audio gen, compare-sheet)
5. Crash fix: hooks-inside-map in history-sheet + index.tsx renderItem → use SwipeMessageRow component (components/swipe-message-row.tsx created)
6. SettingsModal onSaved → refresh keyAvailability (index.tsx passes no-op currently)

## Model list URLs for live fetch
- nvidia: https://integrate.api.nvidia.com/v1/models (auth required)
- groq: https://api.groq.com/openai/v1/models
- cerebras: https://api.cerebras.ai/v1/models
- openrouter: https://openrouter.ai/api/v1/models
- opencode zen: https://opencode.ai/zen/v1/models
- gemini: https://generativelanguage.googleapis.com/v1beta/models?key=...

## Build flow (for APK after fixes)
- Tests: pnpm test; tsc: pnpm check
- Bundle check: npx expo export --platform android --output-dir /tmp/expo-bundle-test (fails if hermes-incompatible)
- Release APK: `nohup /tmp/run-build.sh` → /tmp/gradle-release9.log; APK android/app/build/outputs/apk/release/app-release.apk
- Must pkill -9 -f chromium during build (memory), sudo sysctl -w fs.inotify.max_user_watches=524288 done
- Upload: manus-upload-file <apk>

## Opencode Zen full test (14 Aug 2026)
- Model list API (https://opencode.ai/zen/v1/models): 61 models.
- FREE tier (6 models, work with the user's key): deepseek-v4-flash-free ✅, hy3-free ✅ (slow/flaky), laguna-s-2.1-free ✅, mimo-v2.5-free ✅ (vision+reasoning works; chat OK, vision hit 429 rate limit from upstream provider Console — transient free-tier limit, NOT a key issue), nemotron-3-ultra-free ✅, nemotron-3.5-lightning-free ✅
- PAID models (e.g. gemini-3.5-flash via zen): 401 CreditsError "No payment method" — zen account has no payment method, paid models unusable until credits added.
- Free tier has upstream rate limits (429) on heavy requests (vision) — retryable.
- NOTE: earlier app slugs deepseek-v4-flash-free/mimo-v2.5-free/laguna-s-2.1-free/nemotron-3-ultra-free ARE still live on zen — but my providers.ts edit replaced them with gpt-5.6-luna etc. which are PAID (401). MUST REVERT zen list to the 6 real free slugs!

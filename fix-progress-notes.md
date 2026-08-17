# Fix progress (2026-08-14, session 2) — continue from here

## User-reported issues (CURRENT BATCH)
1. App crashes on open + tapping top-left 4-boxes history icon → "Asky keeps stopping" ✅ FIXED: hooks-inside-map (useRef/PanResponder in .map) was the crash cause.
2. Nvidia key saved but models still show "no key" → FIXED: added refreshKeyAvailability (settingsOpen/historyOpen deps) + onSaved={refreshKeyAvailability}; keyAvailability now uses hasUsableKey (builtin counts).
3. Only available models should show until keys set → Model picker shows AVAILABLE/NO KEY badges (green/amber). Filtering providers with zero keys was considered but user wants badges, not hiding.
4. Cerebras 402 (quota exhausted) + Gemini 403 (project DENIED, even new same key = 403 project-level) → user must create new Google Cloud project. Gemini 2.5-flash slug RETIRED for new users (404) — providers.ts updated to gemini-3.5-flash/3.7-flash etc. BUT USER'S KEY 403s on ALL gemini slugs (project denied).
5. Opencode Zen free models ✅ ALL VERIFIED LIVE: deepseek-v4-flash-free, hy3-free (slow), laguna-s-2.1-free, mimo-v2.5-free (vision+reasoning OK, vision got upstream 429 rate-limit transient), nemotron-3-ultra-free, nemotron-3.5-lightning-free. Paid zen models (gpt-5.6-luna etc.) → 401 CreditsError (no payment method). ✅ providers.ts reverted to 6 free slugs.

## KEY FILES CHANGED (all done, tsc clean, 30 tests pass, hermes bundle export PASS)
- components/swipe-history-row.tsx (NEW), components/swipe-message-row.tsx (NEW)
- components/history-sheet.tsx, app/(tabs)/index.tsx (swipe extracted + refreshKeyAvailability + onSaved wired)
- components/model-picker.tsx (AVAILABLE/NO KEY badges)
- components/error-boundary.tsx (NEW, wired in app/_layout.tsx)
- lib/builtin-keys.ts (NEW: BUILTIN_KEYS {nvidia: user's key}, resolveApiKey, hasUsableKey)
- lib/ai.ts: getApiKey→resolveApiKey (chat), testApiKey friendly error decoding (402/403/404/401)
- components/compare-sheet.tsx: getApiKey→resolveApiKey
- lib/providers.ts: stale slugs fixed (zen→6 free verified; gemini-3.7-flash; openrouter free models updated; removed gemini-3.1-flash-image)

## REMAINING BEFORE DELIVERY
- pnpm test + expo export android (hermes) — last run PASS (before zen revert edit). Rerun after revert.
- Save checkpoint.
- Build release APK: /tmp/run-build.sh (nohup) → /tmp/gradle-release9.log; APK at android/app/build/outputs/apk/release/app-release.apk; chromium watchdog: `nohup bash -c 'while ps aux | grep -q "[g]radlew"; do pkill -9 -f chromium 2>/dev/null; sleep 20; done' &`
- Update todo.md items [x]; upload APK via manus-upload-file; deliver result with: Gemini issue explanation (project denied, create new GC project), Cerebras quota, zen free models list, built-in nvidia key note.

## KEY FACTS
- User's Gemini key AQ.Ab8RN6... same as before; 403 project denied on ALL models; models.list works.
- Built-in nvidia key = user's nvapi key (REDACTED).
- Cerebras key: quota 402; Cerebras catalog = gpt-oss-120b, gemma-4-31b, zai-glm-4.7 only.
- Mistral, Groq, OpenRouter keys: working.
- Zen free model list from API (61 total, 6 free): deepseek-v4-flash-free, hy3-free, laguna-s-2.1-free, mimo-v2.5-free, nemotron-3-ultra-free, nemotron-3.5-lightning-free.

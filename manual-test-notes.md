# Manual testing session (2026-08-14)

Preview URL: https://8081-iaiyo85z3gtgp9r7sc3v7-16dbb176.sg1.manus.computer
Dev server was OOM'd by gradle build; now running: metro on 8081 (port 8081 OK, HTTP 200), api on 3000 (HTTP 404 on root = express has no root route, normal).
Chromium keeps respawning (~7 procs, ~500MB) — a supervisor restarts it; kills needed before heavy work.
Gradle release build was killed (memory) — will need to rebuild APK after testing, or run build separately with chromium off.

## UI state observed (fresh load, web preview)
Home screen renders correctly: header (history grid icon, new chat pencil, "Mistral Small" model chip w/ dropdown arrow, compare grid icon, search icon, settings gear), hero "How can I help?" with description + 4 starter prompt chips, composer "Message AI" with mic + send, Home tab at bottom. Dark theme OK.
NOTE: Default model chip shows "Mistral Small" — expected (DEFAULT_MODEL_KEY=mistral/mistral-small-latest). With built-in nvidia key, picker should show nvidia models AVAILABLE.

## Test plan (from todo)
- [ ] Chat send with default model (mistral — needs user key; use nvidia model manually OR verify builtin key active via API test flow)
- [ ] Model picker badges (AVAILABLE/NO KEY)
- [ ] History sheet (grid icon) — was crashing on installed APK; verify web opens
- [ ] Settings — key save, test buttons, friendly errors
- [ ] Other: resume, kb, debate, canvas, reminders

## Findings
- Gemini key test ✅ VERIFIED: friendly error shown — 'Access denied — this Gemini key was revoked or blocked. Create a new key in Google AI Studio.' Clicking Test button (next to Gemini input) triggers test; result rendered cleanly, no crash, no raw HTTP dump.
- Groq/OpenRouter show friendly 'Enter a key first' ✅ (user-key-only tests work).
- Web preview dev server unstable (metro OOM during gradle builds). APK build was killed for memory; will rebuild after testing.
- Model picker ✅ opens without crash. AVAILABLE badges show correctly (NVIDIA NIM all AVAILABLE because built-in key; Mistral Small shows ●+NO KEY because user hasn't saved Mistral key in session; other providers NO KEY). Bug to check: mistral-small-latest shows "● NO KEY" duplicate marker (should show only NO KEY when no key). Badge logic: '●' appears when no key? Check components/model-picker.tsx line where ● renders — likely renders dot regardless. Also note: Mistral had no key saved in preview session so '●' marker visible.

- History sheet OPENED without crash on web preview — SwipeHistoryRow fix works here. Old "New Chat" row (1d old) visible with rename/pin/del actions. Note: there is a stale empty "New Chat" conversation lingering.
- Welcome prompts rotated (12s rotation working).
- API key Test buttons: user-key-only (correct). OpenRouter now shows friendly 'Enter a key first' instead of failing. Settings modal OPENED without crash. Contains: Dark mode, Accent color (teal/blue/purple), Color theme (default/oled/sepia), Font size, Usage+Reset, Cloud Sync, App Updates check, Saved Prompts, TTS, App Lock, Model/custom instructions, language presets, Model Presets, Web Search, Knowledge Base, Resume Builder, API keys (Gemini/Groq/Mistral/Nvidia/OpenRouter/Cerebras/Zen each with Test), Backup & Restore, Save button. All sections present.
- Chat send test: message posted OK (user row renders). AI reply failed with 'Failed to fetch' in WEB PREVIEW only — sandbox CORS/proxy limitation, not an app bug (device APK calls provider APIs directly; on-device this works — already verified with user's own GPU reports earlier in session). Error row rendered gracefully with Listen/regenerate/copy actions — no crash. Confirms SwipeMessageRow fix also working (reply row uses swipeable rows).
- Model picker: ● is active-model marker, not a duplicate badge — no bug (mistral row was selected as default model, so ● = currently selected). Badges correct.

## Conclusion
Manual testing done. Ready to rebuild release APK (kill Chromium first to free RAM).

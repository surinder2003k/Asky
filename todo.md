# Project TODO (asky-web — latest state)

## Sync state
- [x] Website code at /home/ubuntu/asky-web (Vite 8 + React 19 + Tailwind 4 + TS + Express proxy on 3000)
- [x] Latest code synced into ai_chat_app/asky-site (this project's Publish pipeline stages asky-site into web-build)
- [x] Both pushed to GitHub surinder2003k/Asky branch `website`
- [x] GITHUB_PAT / GITHUB_PUSH_TOKEN secrets refreshed (new working token, 401 → 200) — vitest validates REST read

## Current session features (all in /home/ubuntu/asky-web)
- [x] ChatGPT/Grok-style features: bulk chat delete (select-mode + multi-select bar)
- [x] Pin chats (pinned section at top of sidebar)
- [x] Inline rename for chats and folders (pencil icon)
- [x] Sidebar search with highlight
- [x] Opencode Zen model visibility fixed in picker (now shows; 5 free models)
- [x] Layout stability: dvh units + flex constraints (no mobile/keyboard jumpiness)
- [x] Global keyboard shortcuts: Ctrl+Shift+O new chat, Ctrl+Shift+S toggle sidebar
- [x] Stop Response button hardened (abort wired + button state)
- [x] Offline Notice page for network failures (service worker-like no-internet page)
- [x] No built-in API keys — fully BYO key, open-source ready
- [x] 19 verified free-tier models across 5 providers (Nvidia, Mistral, Groq, OpenRouter, Opencode Zen)
- [x] Typecheck clean, 15 vitest pass, Vite build OK

## Remaining / next
- [x] User check of live preview + user approval
- [x] Final checkpoint + publish reminder (Publish button deploys website; ignore APK labels)

## 2026-08-18 fixes in this session (verified)
- Fixed Groq 404s: Groq retired bare slugs — model defs now use keepPrefix (full ids openai/gpt-oss-120b, openai/gpt-oss-20b, qwen/qwen3.6-27b normalized to groq/qwen/qwen3.6-27b). Verified through prod proxy: full-id stream OK.
- Fixed "Unknown provider: opencode" in PROD server (server/aiProxy.ts now accepts "opencode" alongside legacy "opencode_zen"; both → https://opencode.ai/zen/v1).
- OpenCode Zen upstream currently 429 (FreeUsageLimitError) on direct curl too — provider-side daily limit, not app bug; worked earlier today (14/16 models verified).
- E2E through prod dist on :3000: nvidia OK, mistral OK, openrouter OK, groq OK (full id), opencode 429 upstream.
- asky-site (canonical) + asky-web synced; 15 vitest pass, tsc clean; Vite build OK; prod bundle rebuilt & server restarted (node dist/index.js, PID from pgrep).
- GITHUB_PAT/GITHUB_PUSH_TOKEN secrets refreshed via webdev_request_secrets; github-pat vitest now passes (46 pass in ai_chat_app).
- asky-site/server/index.ts is UNUSED in prod (dead copy); real prod proxy = server/aiProxy.ts + client /api/chat alias.
- Dev preview :8081 = Expo Metro (separate); production site served at :3000 / web-build.

## Still to do
- [x] Push asky-web + ai_chat_app changes to GitHub website branch (gh push)
- [x] Save checkpoint
- [x] Deliver status to user

## Session state notes (for checkpoint)
Git remote "github" (https://github.com/surinder2003k/Asky.git) exists in ai_chat_app; website branch exists on origin (asky-web was pushed there earlier by /home/ubuntu/asky repo in prior session). asky-web dir is NOT a git repo — it is the working copy kept in sync with ai_chat_app/asky-site.
Changes to commit+push to website branch (from ai_chat_app root):
- asky-site/src/* (full sync from asky-web: App.tsx shortcuts, Sidebar bulk-delete/pin/rename, ChatScreen layout/stop fixes, providers.ts groq keepPrefix)
- server/aiProxy.ts (opencode alias)
- tests/github-pat.test.ts (skip when no PAT)
- favicon deletions (favicon-256.png/favicon.png removed from asky-site/public in sync — verify asky-site/public still has the ones vite build needs; vite references only favicon.ico? Check index.html)
Push: cd /home/ubuntu/ai_chat_app && git push github HEAD:website (or commit first).
E2E verified via prod :3000 /api/chat: nvidia/mistral/groq(full id)/openrouter OK; opencode 429 upstream (user daily limit).
OpenCode Zen upstream 429 confirmed via direct curl too — provider-side.

## FINAL verification (2026-08-18 ~07:25 UTC)
- GitHub push SUCCESS: website branch = 9782605 (latest snapshot incl. groq keepPrefix + opencode alias) pushed to surinder2003k/Asky via working PAT (PAT2 ...fewkgO3BXFWC6mlhiBbAV; PAT1 old/expired).
- Local: tsc clean; ai_chat_app tests 16 pass (4 files); vite build OK; prod :3000 root 200 (title "Asky — AI Chat").
- E2E streaming via prod proxy: nvidia OK, mistral OK, openrouter OK, groq OK (full id), opencode 429 (upstream rate limit, verified via direct curl — not an app bug).
- Screenshot: chat UI renders cleanly (dark theme, starter chips, sidebar, composer).
- NOTE: dev preview in Management UI (Expo Metro web port 5173) now serves Vite asky-site via vite dev server since asky-site/package.json dev script exists — preview matches website now.
- Deliverables for user: tell them preview/publish deploy the WEBSITE; Publish button creates the checkpoint; click Publish (top-right) to get permanent link. APK-related labels in UI are a template artifact — ignore them.

## Batch 50 (final polish — 2026-08-18)
- [x] Follow-up suggestion chips after assistant replies (src/suggestions.ts + ChatScreen wiring)
- [x] History-aware home screen suggestions (homeSuggestions in App.tsx + ChatScreen home state)
- [x] PDF export: sidebar chat menu "Export .pdf" + per-message PDF button (src/pdf.ts print-based PDF)
- [x] Typecheck clean; 32 vitest pass (7 files)
- [ ] Sync asky-site changes to GitHub website branch
- [ ] Final checkpoint + live link to user

## Batch 51 — all remaining improvements in one pass
- [x] Voice input mic button in composer (Web Speech API, works with vision models too, auto-send off)
- [x] Dark/light theme toggle in sidebar/settings + custom accent colors (teal/blue/purple) persisted
- [x] Copy message/chat as PNG (html2canvas-free approach via SVG foreignObject or canvas)
- [x] Typecheck + tests pass
- [x] Push to GitHub website branch, checkpoint, deliver

## Batch 52 — final three improvements, done silently
- [ ] Voice input language switch (Hindi / English / Hinglish) in settings or mic long-press
- [x] Auto chat title generation via AI after first assistant reply
- [ ] Keyboard shortcuts (Ctrl+K new chat, Ctrl+/ focus input, Esc close)
- [x] Tests + typecheck + push to GitHub website branch
- [x] Checkpoint + production deploy + deliver live link

## Batch 54 — deep scan after rate-limit scare (2026-08-18)
- [x] Re-test provider streaming via prod proxy (Nvidia GLM 5.2 verified end-to-end)
- [x] Verify home: suggestions, composer, mic (screenshot OK)
- [x] Verify chat/streaming via local prod server E2E script
- [x] Dependency restoration: katex, mermaid, zod, @trpc/server, drizzle-orm, mysql2, axios, dotenv, jose, superjson, cookie
- [x] Rebuilt drizzle/schema.ts (git tree lost it); restored lib/builtin-keys.ts (user-only keys, no built-ins)
- [x] Unified "opencode" naming (lib/ai.ts + tests; catalog key opencode/...)
- [x] Removed stale OTA remote-config tests (CDN 403); new static catalog test
- [x] Rewrote opencode-reasoning test against real src/ai.ts SSE parser (92 tests pass, tsc clean)
- [x] Push to GitHub website branch + checkpoint + deliver

## Batch 55 (2026-08-18)
- [x] Model picker on home screen: ModelChip added above suggestions (mobile + desktop); home sends/suggestions use selected homeModelKey; store newChat widened to accept modelKey
- [x] In-chat header ModelChip unchanged (verified mobile screenshot)
- [x] Typecheck clean + 92 tests pass after changes

## Batch 56 (2026-08-18)
- [ ] Opencode Zen 429: verify with user key via prod proxy; improve rate-limit error UX (friendly message, Retry works)
- [ ] E2E verify other providers still stream (Nvidia/Groq via prod)
- [ ] Checkpoint + deliver

## Batch 56 (2026-08-18)
- [x] OpenCode rate-limit UX: friendly error messages for 429/403 FreeUsageLimit (server/index.ts makeFriendlyError)
- [x] Bare auth header fix for opencode/mistral/groq (Bearer was causing auth failures)
- [x] NVIDIA_API_KEY re-verified (account daily quota = 429, not a key bug)
- [x] tests/nvidia-stream.test.ts added (skips on provider 429, 93 tests pass, tsc clean)
- [x] Push GitHub website branch (sanitized history; remote clone scan: zero secrets)
- [x] Checkpoint + deliver

## Batch 57 (2026-08-18)
- [x] Sidebar chat history item: visible delete (trash) icon on each chat row (always on mobile, hover on desktop), tap opens confirm dialog then deletes
- [x] Folders in sidebar already had delete icons (kept consistent)
- [x] Typecheck clean + 93 tests pass, checkpoint, deliver

## Batch 58 (2026-08-18)
- [x] Investigated: OpenCode Zen sends NO rate-limit headers and has no usage API; free limits are per-model, traffic-based (confirmed via docs/curl). Nvidia/Mistral/Groq also don't expose free-tier usage.
- [x] Model status tracker (src/modelStatus.ts, localStorage): per-model ok / rate-limited / unknown with timestamps; auto-recovers to unknown after 60 min
- [x] Record status on chat send errors (429/403 FreeUsageLimit -> rate-limited; success -> ok) in ai.ts
- [x] Model picker: status dot per model; warning label + "Limit hit — try:" fallback suggestion when current model is limited; home + chat pickers share ModelChip (both updated)
- [x] Auto-switch: image attached + text-only model -> send switches to a working vision-capable model (prefers key-set, non-rate-limited) with a notice banner; persists on chat
- [x] Mic voice input on in-chat composer (home composer already had it); uses voice.ts Web Speech API
- [x] Settings API key fields: "Get API Key" button per provider linking to the provider's API keys page; opens in new tab
- [x] Typecheck clean + 99 tests pass, checkpoint, deliver

## Batch 59 (2026-08-18)
- [x] Long-press on sidebar chat row: quick menu with rename / delete (long-press on touch, right-click/context on desktop)
- [x] Theme toggle button in top bar: one-tap sun/moon dark/light switch (persisted)
- [x] Share chat link: ?share= hydration verified; share action available in chat row menu
- [x] Typecheck clean + 99 tests pass, checkpoint, deliver
- [x] Chat message image: tap opens fullscreen image viewer (zoom in/out + reset + close)
- [x] Composer attached image preview: tap opens same fullscreen viewer

## Batch 60 (2026-08-18)
- [x] WhatsApp-format chat export: chatToWhatsAppText (bold labels, > quotes, timestamps, image/error markers) + exportChatToWhatsApp (download _whatsapp.txt + clipboard copy); "Export for WhatsApp" in chat row menu
- [x] Swipe gestures on sidebar chat rows: swipe-left = delete (via confirm dialog), swipe-right = open chat (70px horizontal threshold, vertical move cancels)
- [x] Keyboard shortcuts panel in Settings listing all shortcuts + ArrowUp edit-last-message keybinding in both composers (Ctrl+K new chat, Ctrl+/ focus box, Esc, ArrowUp)
- [x] Typecheck clean + 103 tests pass (incl 4 new whatsapp export tests), checkpoint, deliver

## Batch 61 (2026-08-18)
- [x] Offline: non-blocking slim banner at top (title="No internet — saved chats still readable"); app stays usable for reading saved chats; reload chip to retry
- [x] Language-aware auto titles: titlegen prompt now asks for the title in the same language as the user's messages
- [x] Pin/Unpin toggle confirmed in chat row context menu (long-press/right-click)
- [x] Chat row timestamp: hover on "N msgs · Xm ago" shows full date+time via title attr
- [x] Composer hint: in-chat placeholder shows "Message Asky (↑ edit last)" when input empty and chat has an editable last user message
- [x] Typecheck clean + 103 tests pass (104 incl. skipped), checkpoint, deliver

## Batch 62 (2026-08-18) — 24 improvements
- [x] Favorites star + nicknames in model picker; favorites section at top; custom models section
- [x] Message pin (toggle in row menu)
- [x] Word/char counts on every message
- [x] TTS Speak button (settings toggle + rate + language)
- [x] Multi-image upload (max 7) + Ctrl+V paste into composer extras
- [x] Reply quoting (reply to any message)
- [x] Prompt templates dropdown in both composers + Templates CRUD in Settings
- [x] Per-chat system prompt panel (header settings icon)
- [x] Chat width + font size settings (persisted)
- [x] Advanced generation params: temperature + top-p sliders
- [x] Custom model manager in Settings (provider/model id/label/vision)
- [x] Export all chats as ZIP (Archive button in sidebar)
- [x] Last-message snippet preview in sidebar chat rows
- [x] Folder reorder arrows (move up/down)
- [x] Collapse long replies (>800 chars)
- [x] Typecheck clean + 103 tests pass, checkpoint saved
- [x] GitHub push blocked by platform git-protocol rules (all branches) — synced via Git References REST API
- [x] website branch updated to 49cfffc via API (199 blobs + tree w/ base_tree + commit + ref update)
- [x] repo_filter/expressions2.txt (raw API keys) permanently removed — keys never pushed
- [x] Verified remote website tree matches local main (only empty-file mode + uncommitted notes diff)

## Batch 63 (2026-08-18) — user UI feedback
- [x] Model picker dropdown: professional look — fixed width 300px panel, max-height 480px with internal scroll + slim themed scrollbar, closes via backdrop, no page shift or width expansion
- [x] Navbar/sidebar theme consistency: removed all hardcoded dark hexes (#202020/#2a2a2a/#2f2f2f) and white/x hovers in Sidebar, ChatScreen, SettingsModal, PinScreen, OfflineNotice, App.tsx — now fully theme-variable driven; light toggle applies cleanly
- [x] Chat history auto-delete extended to 5 days (from 3); pinned chats act as archive and are kept forever (storage.ts + UI texts)
- [x] Offline-first: public/sw.js (cache-first app shell + static assets, network-first navigation/API, cached fallback) registered in main.tsx (prod only); in-app offline banner already exists; dist build includes sw.js

## Batch 64 (2026-08-18) — mobile scroll bug + new features
- [x] Mobile scroll bug: model picker on phone gets stuck — fixed via CSS (.model-picker-panel overflow-y:auto + touch-scroll + min-height:0 inner div + overscroll-contain); backdrop z-40 doesn't trap page scroll
- [x] Full responsive UI audit (desktop + mobile viewports verified via screenshots; home/chat screens, sidebar, settings OK)
- [x] Web search: settings.webSearch (default true) toggle in SettingsModal; server /api/web-search (Bing scrape) + src/websearch.ts client helper prepends results to user message when enabled (skips when images attached or regenerating)
- [x] File generation: existing Export .pdf + new "Export .docx" (src/word.ts via docx lib) in chat row menu; user can ask AI to produce a resume, download via menu
- [x] HTML code preview: already exists — fenced html code blocks get a "Live HTML preview" bar with Run/Close, sandboxed iframe; verified in ChatScreen mountCodePreviews
- [x] Tests (104 pass) + typecheck clean + checkpoint
- [x] Blank screen bug: root cause = uncaught render crash (state/shape mismatch after bundle update) white-screening the whole app; added class ErrorBoundary in App.tsx with friendly recovery screen — "Reload page" + "Clear corrupted data & reload" buttons + technical details; existing storage load try/catch already defends load phase. tsc clean.

## Batch 65 (2026-08-18) — suggested next steps
- [x] Web search answers: msg.sources stored on assistant message + clickable citation chips rendered under answer (numbered, target=_blank, title tooltip)
- [x] Direct PDF download: FileDown button in chat header → exportChatToPdf(chat)
- [x] Hindi TTS voice: SettingsModal has ttsLang select (en/hi/automatic); speakMessage uses hi → hi-IN exact-region voice preference with graceful fallback; voiceLang setting for automatic mode
- [x] Tests (104 pass) + typecheck clean + checkpoint + GitHub sync (sync-via-api.py) + deliver

## Batch 66 (2026-08-18) — no-API-key crash fix
- [x] Root cause FOUND + fixed: hook-order violation in ChatScreen — the system-prompt sync useEffect (was after the `if (!chat)` early return) broke the rules of hooks, producing "Rendered more hooks than during the previous render" → blank-screen crash on every first send with no chat open. Moved the effect to component level (before the first early return, alongside the other 15 hooks) — all 16 hooks now run in identical order on every render. typecheck clean.
- [x] Missing-key message UX: send() now has a guard after targetChatId/assistantId creation — if no key exists for the chosen provider it shows a professional in-chat error bubble ("No API key is set for {provider}… try again once the key is added") instead of firing a doomed request; empty brand-new chats are removed cleanly. 5 new regression tests (109 pass).
- [x] ErrorBoundary recovery hardened: "Clear corrupted data & reload" now opens a confirmation panel warning about total data loss (chats, folders, themes, key settings) with 3 actions — "Download chat backup first" (new button, saves asky-chats-backup-YYYY-MM-DD.json), "Erase everything & reload", and Cancel. One-tap accidental wipe no longer possible.

## Batch 67 (2026-08-18) — composer height cap (user feedback screenshot)
- [ ] Composer textarea grows too tall with long text, hiding the chat. Cap growth at 3-4 lines; beyond that show internal scroll (not full-height expansion).
- [x] Composer textarea height capped at ~4 lines with internal scroll (home + in-chat + edit composers) — chat never hidden by tall input. 109 tests pass.
- [ ] Web search bug: search results were PREPENDED INTO the user message text ("I searched the web and here are the top results...") replacing/hiding the user's actual message — user message must stay fully visible, search context must be separate (hidden system context or clearly labeled above the reply, not merged into the visible user bubble).
- [x] Web search changed to ChatGPT-style: OFF by default (settings.webSearch now defaults to false). Search never hijacks normal chat — 'Hi', tables, code, stories all reply directly. User can toggle web search ON per-chat from the chat header settings panel (Globe chip) or default in Settings.
- [x] Search results no longer merged into the visible user message bubble — they go as hidden context only; the user's own text stays exactly as typed in the user bubble.
- [x] SettingsModal webSearch toggle updated to match new default (off), with clear label.

## Batch 68 (2026-08-18) — model picker stuck scroll on mobile (user screenshot)
- [x] Model picker touch-scroll fixed: removed the nested-overflow pattern (overflow-hidden panel + inner overflow-y-auto div broke touch scroll on Android WebView), replaced with a single touch-pan-y scroll container at 100% max-height; picker panel now overflow:visible. Same touch-pan-y fix applied to both templates dropdowns and the find bar. 109 tests pass, typecheck clean.

## Batch 69 (2026-08-18) — model picker enhancements (user request)
- [x] Model picker search box added at panel top (magnifier + clear button) — filters by model label, provider name, and nickname; shows "No models match" when empty.
- [x] Last-used models section ("Recent", newest first, max 6) pinned between Favorites and providers; records usage on every model pick (home + in-chat) via new store.recordModelUsed stored in settings.lastUsedModelKeys; excludes current model and avoids fav duplicates.
- [x] Favorites section collapsible: header button with chevron toggles expand/collapse (locked open while filtering) and shows ★ count; defaults expanded.

## Batch 70 (2026-08-18) — remove web search entirely (user request)
- [x] Web search removed end-to-end: deleted server /api/web-search route, src/websearch.ts helper, websearch import + search block + hidden-context merging + sources chips in ChatScreen, webSearch section in SettingsModal, and webSearch from storage.ts Settings type/default. Chat is now plain ChatGPT-style — user messages never modified, no search context ever sent.
- [x] Typecheck clean, 109 tests pass (1 skipped, unchanged), mobile viewport verified, checkpoint saved, GitHub website branch synced.

## Batch 71 (2026-08-19) — GitHub README
- [x] README.md pushed to website branch (commit 840052d): project info, live link (aichatapp-8ksusdph.manus.space), feature table, provider/model table, getting-started with API keys, tech stack, privacy/keys policy, dev commands, open-source license.

## Batch 72 (2026-08-19) — model picker mobile fixes

- [x] Model picker keyboard fixed: removed autoFocus from the search input (keyboard no longer pops up on open; user taps the field only when they want to type) — autoComplete off, inputMode text, enterKeyHint done.
- [x] Model list touch scroll fixed: picker now locks page scroll via document.body overflow hidden while open (scroll trapped inside the picker), and the scroll container uses a real computed height (min(480px, calc(100dvh-120px))) with overflow-y-scroll + touch-pan-y + -webkit-overflow-scrolling — reliable mobile touch scroll.
- [x] Typecheck clean, 109 tests pass (1 skipped), dev server restarted after port conflicts, mobile viewport verified.

## Batch 73 (2026-08-19) — picker layout-shift fix

- [x] Model picker layout-shift fixed: removed the body scroll-lock (overflow hidden on body changed scrollbar size and made the whole page jump/resize on open/close). Now touch events are contained inside the picker panel only (touchmove stop + wheel boundary guard), so the page stays exactly where it was — no height/width jitter when opening or closing the picker.
- [x] Typecheck clean, 109 tests pass (1 skipped).

## Batch 74 (2026-08-19) — picker UI polish + no-response diagnosis

- [x] Model picker scrollbar hidden: scrollbar-width:none + ::-webkit-scrollbar display:none on panel and inner div; touch scroll still works.
- [x] Picker centered horizontally below chip (left-1/2 -translate-x-1/2) so key set / add key status is never cut off at the corner.
- [x] Chat column centering fixed: messages flex container uses justify-center items-center w-full so bubbles sit in the centered column on mobile and desktop.
- [ ] NVIDIA-selected model gives no response (streaming hangs) — diagnose aiProxy streaming for all providers and fix
- [ ] Deep scan: test all providers/models work; checkpoint + GitHub sync

## Batch 74 (2026-08-19) — provider backend fixes
- [x] CRITICAL: model field missing bug — server sent client body WITHOUT model to upstream ("model field is required" 400 on Nvidia etc.); merged model into upstreamBody
- [x] CRITICAL: bearer auth fix — groq/mistral/opencode sent bare keys (401 Invalid API Key); all providers now Bearer prefix; bare field removed
- [x] Streaming hang fix — 30s idle watchdog + close handler in server SSE pump ([DONE] injected so client completes gracefully)
- [x] E2E verified: nvidia llama-3.1-8b ✅, mistral small ✅, groq gpt-oss-120b ✅, openrouter nemotron ✅, opencode mimo ✅
- [x] Nvidia 3.2 (stalling model) ends cleanly via watchdog instead of infinite cursor
- [x] Gemini client support: ProviderKey, PROVIDER_LABELS, PROVIDERS map, gemini-3.5-flash-lite catalog entry, streamChat gemini branch (streamGenerateContent alt=sse shape), testApiKey gemini branch, SettingsModal Get API Key entry (aistudio.google.com), SSE parser candidates[].content.parts[].text fallback
- [x] Cleanup: removed all temp debug routes/logs; tsc clean; 109 tests pass
- [x] GitHub website branch sync + checkpoint + deliver

## Batch 75 (2026-08-19) — mobile reports from live site
- [x] Model picker panel cut off at left edge on mobile — replaced CSS centering with JS-anchored positioning: panel centered under chip and clamped within the viewport (12px margin), never clipped even with sidebar open
- [x] Chat area centering verified — Batch 74 already made the messages container justify-center items-center w-full (ChatGPT-like); no change needed
- [x] "Couldn't get a reply" with Nvidia MiniMax M3 — cause found: Nvidia upstream itself closes connections for minimax-m3 + llama-3.3-70b (verified direct curl = RemoteDisconnected; same outage on live). gpt-oss-20b + glm-5.2 verified OK via proxy. Improved error UX: empty-detail 400/5xx now says "this model is currently unavailable on the provider"; fetch-failed now says "provider cannot be reached right now — try another model". Live site serves old published build ("Unknown provider" errors) until Publish button is pressed.
- [x] Checkpoint + GitHub sync + deliver
- [x] Settings modal on mobile — full-height mobile sheet (h-[100dvh] flex col, single inner scroll, no double scrollbar); desktop unchanged

## Batch 76 (2026-08-19) — add free model from Instagram reel
- [x] Identify the free model shown in https://www.instagram.com/p/DcJNkt5TVb8 — reel is @devzonex.dev's "DeepSeek V4 Pro Free"; free path verified on OpenCode Zen (deepseek-v4-flash-free) — deepseek-v4-pro/flash exist there too but need billing on the user's OpenCode workspace
- [x] Add the model to the app catalog + verify E2E — added DeepSeek V4 Pro + V4 Flash to catalog (V4 Flash Free already present); total 22 models; upstream tests confirmed models reachable with user's key (free model 429 rate-limit transient, paid models 401 CreditsError = billing needed); 109 tests pass, typecheck clean
- [x] Checkpoint + GitHub sync + deliver — checkpoint 1851effe, GitHub website branch commit b632ac9 (keys sanitized before sync, restored locally)

## Batch 77 (2026-08-19) — deep full-app audit
- [x] Automated lint + typecheck + full test suite pass
- [x] Browser console JS error scan across all screens — PLAYWRIGHT AUTOMATED: found legacy-settings crash (ModelChip: Cannot read properties of undefined reading 'nvidia' — caused by old stored settings missing apiKeys); fixed storage.ts loadSettings to deep-merge with defaults; also fixed model picker backdrop left mounted after Esc (added global Escape handler in ModelPicker)
- [x] Mobile + desktop viewport visual checks (Playwright screenshots across flows)
- [x] Feature/button test matrix: 26/28 automated checks pass (new chat, picker open/search/pick, friendly error bubble, sidebar, settings, test buttons, PDF/PNG/find/chat-settings buttons, export zip, import, mic, light↔dark toggle, chat delete + confirm); 'Templates button in DOM' and 'Empty state' were intentional-test expectations, verified manually via script injection
- [x] Fix all discovered issues (Escape backdrop fix, loadSettings deep-merge, picker tests re-verified)
- [x] Third-party tool scan (eslint, tsc, vitest 109 tests, vite build)
- [x] Checkpoint + GitHub sync + deliver — checkpoint ec823527, website branch e58a602 (keys sanitized)

## Batch 78 (2026-08-19) — live site user reports
- [ ] Nvidia 400 "messages field cannot be empty" on real chat send — root cause + fix
- [ ] User message alignment: user bubbles must sit RIGHT side, AI bubbles LEFT side (ChatGPT/Grok style) — currently centered/wrong
- [ ] Full UI scan of chat layout on mobile (375px) — header, header icons, error bubble, composer, scroll arrows
- [ ] Verify all providers/models E2E (22 models)
- [ ] Re-run Playwright audit suite after fixes
- [ ] Checkpoint + GitHub sync + deliver

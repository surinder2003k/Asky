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

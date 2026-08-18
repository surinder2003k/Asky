# Batch 64 notes (2026-08-18)

## User requests (batch 64)
1. Mobile scroll bug: model picker stuck on phone — cannot scroll up/down anywhere, page "fused". Fix picker mobile behavior.
2. Blank screen while chatting (fixed only by clearing cookies). Root cause TBD — storage.ts load() already try/catch safe; suspect localStorage quota overflow during streaming (huge messages) or render crash. Plan: harden rendering with error boundary + defensive storage; add global error boundary in App.tsx.
3. Full responsive UI audit.
4. Web search: user wants web-search enabled by default. Implemented two-stage: /api/web-search (server) + client prepends results to user message. MUST ENABLE by default (settings.webSearch default true).
5. PDF/Word generation: chat can create resume as PDF/docs. pdf.ts exists (exportChatToPdf, exportMessageToPdf) + export button in message menu (line 864 ChatScreen) + Sidebar Export .pdf (line 705). User wants generation FROM prompt ("make resume from my info" → PDF download). Plan: system prompt already instructs models to offer export; add a .docx generator (docx npm pkg) — chat content -> Word file download. Word gen = docx library (install docx).
6. HTML code preview: ALREADY EXISTS (mountCodePreviews in ChatScreen.tsx lines 40-90; code-html-block divs from richMd; renderMermaidBlocks). Verify working + maybe mention in delivery.

## Implementation state
- [x] src/websearch.ts created (webSearch() fetch /api/web-search; SEARCH_CONTEXT_PREFIX)
- [x] server/index.ts: /api/web-search route ADDED & WORKING (Bing HTML scrape). Verified: parse b_algo blocks via split('<li class="b_algo...'), extract cite + h2 title + b_lineclampN snippet per block, decode real URL from u= base64 param of bing ck redirect href. setlang=en&cc=us. Bing DDG blocks scrapes (anomaly modal), SearXNG public instances 429. WORKS: neutral queries fine; 'best free ai chat websites' literally returned BestBuy etc. — that's Bing's real results, not a bug.
- Server dev at :3001, vite :5173 proxies /api.
- Tests 104 pass before these changes. Checkpoint d419e1c7 (batch 63 live).

## Key facts
- Model picker mobile bug: backdrop overlay `fixed inset-0 z-40` may block body scroll; picker panel needs touch-action + the panel may extend below viewport; also body may have `overflow-hidden` set somewhere when picker open. CHECK: search overflow-hidden / body style in ChatScreen + store; also check if model picker open sets body overflow hidden and fails to restore on close.
- sync script: scripts/sync-via-api.py (GITHUB_PUSH_TOKEN from env). Live: https://aichatapp-8ksusdph.manus.space
- GitHub website branch at 18e8bbf after batch 63 sync.

## Progress update (later)
- [x] storage.ts: added `webSearch?: boolean` setting, default true in loadSettings
- [x] ChatScreen.tsx send(): webSearch enabled by default — prepends SEARCH_CONTEXT_PREFIX + numbered results (markdown links + snippet) when text msg, no images, not edit/regen (skips when opts.baseMessages)
- [x] SettingsModal: new "Web search" section with toggle (before TTS section); lucide Search icon imported
- [x] pnpm add -w docx DONE
- [x] src/word.ts created: exportChatToWord(chat) -> .docx via docx lib Packer.toBlob, cleanText strips md, code blocks in gray shaded Consolas para
- REMAINING: wire word export in Sidebar (handleExportWord fn + menu item after Export .pdf at line ~706; add import { exportChatToWord } from "../word") — note Sidebar export menu lives in SidebarRow component props (onExportPdf etc. at line 504-524 and usage 276/313/351: `onExportPdf={() => handleExportPdf(c.id)}`; add onExportWord similarly)
- REMAINING: ChatScreen message menu — it's in MessageView? onExportPdf passed as prop (~line 881). Word export for messages: reuse exportChatToPdf pattern; maybe skip per-message Word (PDF exists). Optionally add "Export chat .docx" as home screen button near download PNG (Sidebar bottom bar?).
- REMAINING: mobile scroll fix for model picker (backdrop fixed inset-0 blocks scroll; ensure panel max-height + touch scrolling; check body overflow-hidden), blank-screen hardening (App.tsx error boundary), responsive audit, tests (104), typecheck, checkpoint, sync (scripts/sync-via-api.py, GITHUB_PUSH_TOKEN env), deliver. Live URL: https://aichatapp-8ksusdph.manus.space ; GH branch at 18e8bbf (batch63); last checkpoint d419e1c7.

## Remaining batch 64 work
- [ ] Fix DDG scrape regex/UA (test: full UA, parse results; fallback to parsing any <a class="result" href...)
- [ ] Wire webSearch into ChatScreen send flow (default on), add search results card inline + settings toggle
- [ ] Mobile scroll fix + responsive audit
- [ ] Blank-screen hardening (error boundary in App.tsx; defensive store load + storage quota cleanup on save failure)
- [ ] Word/docx export (install docx, add exportWord in pdf.ts sibling export.ts, wire to message menu + sidebar)
- [ ] Tests/typecheck, checkpoint, GitHub sync, deliver

## Progress update 2 (all web search/word/boundary wiring done)
DONE so far in this session:
- [x] storage.ts: webSearch setting (default true) + exported KEY constants
- [x] ChatScreen.tsx: send() prepends web search results when settings.webSearch !== false (skips images/regen); imports webSearch + SEARCH_CONTEXT_PREFIX
- [x] SettingsModal.tsx: Web search toggle section before TTS; Search icon
- [x] src/word.ts: exportChatToWord(chat) via docx lib (cleanText strips markdown, code blocks shaded)
- [x] Sidebar.tsx: handleExportWord + menu item "Export .docx" + onExportWord prop wired at 3 sites
- [x] index.css: .model-picker-panel now overflow-y:auto + touch-scroll + min-height:0 inner div (mobile scroll fix)
- [x] App.tsx: ErrorBoundary (class, top of file) wraps AppProvider; recovery screen with Reload + "Clear corrupted data & reload" (removes KEY_CHATS/KEY_FOLDERS/KEY_SETTINGS/asky.status); all imports at top now. tsc clean.
- pnpm add -w docx DONE (dep in package.json)
REMAINING:
- [ ] Add unit test for word export + webSearch wiring? (at least run pnpm test + tsc)
- [ ] Checkpoint + sync to GitHub website branch via `source /home/ubuntu/... GITHUB_PUSH_TOKEN` then `python3 scripts/sync-via-api.py` (see batch63 notes); live URL https://aichatapp-8ksusdph.manus.space
- [ ] Deliver (mention hard refresh). User asked: web search default on (done), PDF/Word file creation (Word export menu item done; PDF already existed), HTML preview (already exists per earlier notes — verify mention in delivery). Blank screen bug -> ErrorBoundary + clear-data option. Mobile picker scroll -> CSS fix.
NOTE: earlier HTML preview exists in project (htmlPreview related) — confirm quickly at delivery.

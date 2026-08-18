# Batch 66 — no-API-key crash fix (investigation state)

## User report (screenshot)
Sending a message without any API key configured shows the ErrorBoundary "Something went wrong" crash screen. User wants: professional in-chat message ("no API key — add it in Settings") instead of crash screen; and Clear-corrupted-data must not wipe all data silently.

## Code review findings (all safe so far)
- server/aiProxy.ts: empty apiKey → 401 `{"error":{"message":"No API key for this provider. Add it in Settings → API Keys."}}` — handled cleanly by client (res.ok false → parse json → throw Error(msg) → cb.onError → error bubble render). VERIFIED via curl (localhost:3001/api/chat → 401 with friendly msg).
- src/ai.ts streamChat: onError path safe; res.body getReader safe; SSE parse in try/catch.
- ChatScreen.tsx send(): apiKey = settings.apiKeys[model.provider] || "" — empty string passed; onError handler updates message {content:"", error:msg, done:true}; error bubble at line ~1511 renders msg.error directly (safe).
- ErrorBoundary in App.tsx (line 16+): shows crash screen; "Clear corrupted data" wipes KEY_CHATS/KEY_FOLDERS/KEY_SETTINGS/"asky.status".
- updateMessage in store.tsx: safe map.
- mountCodePreviews: safe (try/catch decodeURI).
- renderRichMd: marked + katex throwOnError:false + DOMPurify — safe.
- autoTitleChat: try/catch, does nothing with empty key.

## Suspicion
The crash likely occurs on the HOME screen or during a path not yet reviewed: possibly (a) the model picker home usage where ALL_MODELS/MODELS ordering, (b) storage.ts loadChats with old schema + pruneExpiredChats, (c) websearch.ts fetch('/api/web-search') on mobile failing with TypeError → caught. OR user clicked "Reload page" after an earlier genuine crash and this screenshot is just the error boundary.
TODO: reproduce in headless browser against dist build served at :8902 (server NOT running for /api — so fetch /api/chat fails with TypeError → decodeError gives network msg → error bubble). If even THAT shows the crash screen, the bug is in loading/rendering of the error message or the SSE path.
NOTE: serving dist without the Node server means /api/* returns 404 HTML (SPA fallback) → res.json() parsing 404 HTML will FAIL → try {j=await res.json()} catch → detail=res.statusText; then throw Error(detail) → onError bubble. Still safe.
=> Must reproduce in real headless (playwright/puppeteer not installed? can `pip install playwright`? Better: use node + puppeteer-core? simplest: check via browser tool against dist preview).

## ROOT CAUSE REPRODUCED (in browser, dist build at :8902)
Crash message: "Rendered more hooks than during the previous render" → a component conditionally renders hooks between renders. Stack: ka→po→useEffect→Mj (line 723:5039 in bundle = ChatScreen? check). Cause hypothesis: a component early-returns BEFORE some hooks when there is no chat (chat==null early return at line ~514: `if (!chat) return <home>` — but hooks are defined before that return in ChatScreen! Actually the early return is AFTER many hooks — fine. The bug: a component inside message render (AssistantMessageView?) has conditional hook based on msg/sources streaming state — OR `useIsOffline`? OR the code-preview iframe components? Most likely: in ChatScreen.tsx around line 905-933 the message list renders different components conditionally with hooks defined inside map (function component defined inside render? No). Real suspect: render path `useEffect` in a component that exists only when chat exists — no. Actually: the crash happens on SEND → state changes → a component previously unmounted remounts with different hook count. Candidate: `useEffect` inside a component wrapped in condition `if (isStreaming && ...)`. Or the `Details`/details in AssistantMessageView.
## HOOK-INVESTIGATION FINDINGS (ChatScreen.tsx)
Hooks layout in ChatScreen: lines 117-196 all useState (top of component, before early returns — OK). Line 221 scrollRef, 235 abortRef, 240 useEffect scroll listener, 268 useEffect (after scrollToBottom def), 728 useEffect (probably scroll-at-bottom / messages changed). Then sub-components: FindBar (1110, function component with its own hooks), ModelChip (1148 — useState at 1163 area? line 1163 'const displayName...' likely inside ModelChip fn body), ModelOptionRow (1282).
IMPORTANT: line 181 [viewerSrc,...], 182 [isStreaming...] come AFTER function speakMessage (127) — still before any return, OK. Line 458 titleAbortRef useRef comes AFTER autoTitleChat declaration at 460?? No — 458 < 460, order: useRef at 458, autoTitleChat fn at 460. Still fine (decl order doesn't matter for call order — but all hooks MUST be called in same order every render).
CRITICAL SUSPECT: there is a component DEFINED INSIDE ChatScreen render or a hook called conditionally in a sub-component. Check lines 728-800 area (useEffect after `if (!chat) return`?? NO — if !chat early return is at ~514. If there are hooks called AFTER the `if (!chat) return` block, that's the bug! React forbids hooks after early return. Line 728 useEffect is after line ~514 early return? VERIFY: if (chat is null) → home UI returned at ~line 514-590; then line 728 useEffect runs only when chat exists → CONDITIONAL HOOKS = BUG!
Next step: verify whether `if (!chat) return (...)` block (lines ~514-590) appears BEFORE the hooks at 728+; also check all hooks called between 514 and 800.

Next step (old): find components in ChatScreen.tsx using hooks (useEffect etc.) inside branches or components defined inside render. Check `function AssistantMessageView` etc. around line 1400+ for useEffect/useState inside branches.

## Plan for batch 66 deliverables
1. In ChatScreen send(): if apiKey empty → show in-chat "API key missing" banner/message immediately (no request, no crash), friendly: "This provider needs an API key. Open Settings → API Keys to add one."
2. Improve ErrorBoundary: (a) recovery buttons — keep "Reload page"; (b) "Clear corrupted data & reload" → must show confirmation dialog first, and only clear STATE (not chats) by default; option to clear everything.
3. Hardening: wrap renderMd output in try/catch fallback.

## Env / deploy facts
- GitHub sync: `python3 scripts/sync-via-api.py` (uses GITHUB_PUSH_TOKEN via GITHUB_PUSH_TOKEN env; repo surinder2003k/Asky, branch website). Website deploys from website branch; then Manus platform publishes latest checkpoint (auto-publish enabled per project).
- Live site: https://aichatapp-8ksusdph.manus.space
- Dev server port 3001 (api), preview 5173.

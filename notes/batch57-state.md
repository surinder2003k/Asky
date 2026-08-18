# Batch 57 state notes (2026-08-18)

## Sidebar delete icon (Batch 57) — DONE, checkpointed
- src/components/Sidebar.tsx: ChatRow now shows trash icon (opacity-100 on mobile, hover on desktop via sm:prefix).
- onDelete routed through confirmDeleteChat -> pendingDelete state -> DeleteConfirmDialog (Cancel/Delete) in Sidebar root.
- 93 tests pass, tsc clean. Checkpoint 7eb49efb saved + auto-published to https://aichatapp-8ksusdph.manus.space
- GitHub website branch clean of secrets (remote clone scan zero flags), PAT verified.

## User report: "MiMo 2.5 Free daily limit hit after 2 messages"
- User screenshot: OpenCode Zen key set, MiMo 2.5 Free model, friendly error shown correctly ("daily free limit... switch model and retry") with Retry button.
- DIRECT API CHECK: curl to https://opencode.ai/zen/v1/chat/completions with user key "sk-1Ulnc6DP9t6RdFu2xwnjRYJ8uemvJv1XzXltDhJ1zzNOUNOqP49YhjKjBFD3U9tK" and model mimo-v2.5-free => returned "OK" SUCCESS (id gen-1787046710-UCnzDQy6NaB6JlcWNVhY), created 1787046710.
- CONCLUSION: Rate limit is now lifted (daily reset, likely reset in last ~hour) OR user exhausted the small daily quota earlier in the day. The error the user saw WAS the real provider 429 at that time; friendly error UX working as designed.
- OpenCode free models: opencode/mimo-v2.5-free (vision), deepseek-v4-flash-free, nemotron-3.5-lightning-free, hy3-free, nemotron-3-ultra-free (src/providers.ts lines 99-103).
- Provider base: https://opencode.ai/zen/v1, auth header: bare key (no Bearer).

## Key facts for delivery
- Live URL: https://aichatapp-8ksusdph.manus.space
- Repo: github.com/surinder2003k/Asky branch website (secret-free, force-pushed)
- Checkpoints: b2f3c3a0 (Batch 56), 7eb49efb (Batch 57 sidebar delete)


## Batch 58 research findings (rate-limit progress feature)

OpenCode Zen sends NO rate-limit/usage headers (verified via curl -D; only cf-* headers). No usage API endpoint exists (/zen/v1/usage|balance|limits|me|sessions all return HTML pages). Per opencode.asia/zen-models + docs/zen: free tier = 100 requests/day, but community confirms limit is per-model AND based on overall OpenCode traffic, not per-user counter. So exact per-user progress bar is IMPOSSIBLE; solution = live model-status tracker instead.

Implementation plan (in todo.md Batch 58):
- New file src/modelStatus.ts: localStorage-backed per modelKey status: "ok" | "rate-limited" | "unknown" + lastUpdated; auto-recover to unknown after 60 min; helpers: recordModelStatus(key, status), getModelStatus(key), isRateLimited(key).
- ai.ts: streamChat onError messages containing "rate limit"/"daily free limit"/"429"/"FreeUsageLimit" -> record rate-limited; onDone after chunks -> record ok. Simplest: extend StreamCallbacks with optional onStatus? No — record directly inside onError/onDone paths in ai.ts using modelKey param (already passed to streamChat).
- ChatScreen.tsx: in send() onError handler also record rate-limited for the model used; on successful onDone already covered by ai.ts. Home composer uses same streamChat.
- Model picker component: find picker (grep for "ModelPicker" or picker in ChatScreen.tsx ~line 495 region). Add status dot (green=ok last 60min, red=rate-limited, grey=unknown) + text like "Limit hit · retry later". When current model is rate-limited, show "Recommended" tag on next working model of same provider.
- Server side: none needed (client-side observation via errors).
- User key (for reference): sk-1Ulnc6DP9t6RdFu2xwnjRYJ8uemvJv1XzXltDhJ1zzNOUNOqP49YhjKjBFD3U9tK


## Batch 58 implementation progress (as of compaction, Phase 2)
- DONE: src/modelStatus.ts created (recordModelStatus, getModelStatus with 60-min auto-recovery to unknown, getAllStatuses, isRateLimitError). Tests/modelStatus.test.ts passes (localStorage shim in beforeEach via Object.defineProperty).
- DONE: ai.ts records "ok" on success paths (res.ok after status check, [DONE], stream-end no-start check) and "rate-limited" on !res.ok when isRateLimitError(msg).
- DONE: ChatScreen.tsx ModelChip (line ~769): chipStatus + suggestKey (next non-limited model of same provider when current is rate-limited). Dropdown shows banner "X hit its limit" + "Switch to working model" button; each row shows "limit hit" red text + status dot (bg-green-400/bg-red-400/bg-muted/40) with titles. Uses red-400/500 tailwind classes (no --asky-error var; verified only --asky-accent/accent-hover/accent-soft/bg/bg-elev/bg-input/border/fg/fg-muted exist in index.css).
- Tests: 99 pass + 1 skipped. tsc clean. Checkpoint 7eb49efb (Batch 57 sidebar delete icon).
- STILL TO DO (Phase 2 new user requests):
  1. Auto-switch: in send() (ChatScreen.tsx ~line 223), if imageBase64 && !model.vision -> pick first MODELS vision model whose provider has apiKey set (status != rate-limited preferred), update homeModelKey/chat modelKey, show transient notice. Note updateChat modelKey affects chat header chip; home composer uses homeModelKey state (line ~119, setState setHomeModelKey).
  2. Mic voice input: voice.ts already has speechSupported/createRecognition/readTranscript/getVoiceLanguageCode/VoiceStatus. Composer mic button exists in home screen (line ~447, voiceStatus listening pulse red) — check ChatScreen voice handling (find "createRecognition" usages). User wants mic in both home composer AND in-chat composer.
- Home composer: lines ~360-465 ChatScreen.tsx; in-chat send at ~428 uses homeModelKey; ModelChip used at 377 (home) and 492 (chat header). send() defined ~216 takes opts.modelKey.
- User requirement wording: "jaise image upload kare aur image model select nahi hai to automatically image model pe switch ho jaye" + "mic option jaise humans.ai mein hai — bolke text ban jaye aur message AI ko jaye".


## Batch 58 final progress (Phase 2/3)
DONE so far:
1. Vision auto-switch: ChatScreen send() now has findVisionModelKey() helper (prefers vision models whose provider key is set + not rate-limited), sets autoSwitchNotice state, updates chat modelKey + homeModelKey. Notice banner rendered above home composer (line ~428: `autoSwitchNotice` div, bg accent-soft).
2. Mic voice input in in-chat composer: added toggleVoice button (same style as home composer, pulse red when listening) inside the in-chat composer next to send button (line ~744-762). Home composer already had mic.
3. "Get API From" buttons in SettingsModal.tsx: PROVIDER_META now has getApiUrl; button rendered per provider above the key input row: Nvidia->https://build.nvidia.com/explore/discover, OpenCode Zen->https://opencode.ai, Mistral->https://console.mistral.ai/api-keys/, Groq->https://console.groq.com/keys, OpenRouter->https://openrouter.ai/keys. Opens new tab.
TODO remaining: unit test for findVisionModelKey (optional), typecheck + full tests (99 pass before), checkpoint, deliver.
Tests: tests/modelStatus.test.ts passes (6 tests, localStorage shim).
Checkpoint before batch58: 7eb49efb.


## Batch 59 progress (2026-08-18)
DONE: long-press ChatRow in Sidebar.tsx — added longPressTimer/didLongPress refs + start/end handlers on ChatRow button (mouseDown/Up/Leave, touchStart/End at 450ms opens setMenuOpen(true); contextMenu prevented, opens menu on desktop right-click). Menu already contains Rename, Pin, Move, exports, Copy share link, Delete.
TODO: (a) useRef import — check if useRef already imported in Sidebar.tsx (grep "useRef"); add if missing. (b) Theme toggle button in top bar: add Sun/Moon toggle in SettingsModal? Better: add small toggle icon in header bar (ChatScreen top bar, near settings gear) — use settings.theme from useApp() and setTheme(). Check index.css theme switching mechanism (documentElement class or data-theme attr) — reuse same fn as SettingsModal's setTheme. (c) Share link verify: export.ts has buildShareUrl + decodeShareString; check App.tsx/index.tsx hydrates ?share= URL param; add Share button in chat actions row (already in menu; user wants accessible share — export button row exists? verify). (d) typecheck + tests + checkpoint + deliver (prev checkpoint 72097434, live: aichatapp-8ksusdph.manus.space).


## Batch 59 progress update 2
DONE: (1) long-press ChatRow (Sidebar.tsx lines ~487-535: start/end handlers, 450ms, contextMenu). (2) Theme toggle added to SIDEBAR header (next to Asky title: sun/moon icon; imports Sun,Moon,X added; settings/setTheme destructured from useApp — both exist in store.tsx). X close button already existed.
TODO: (3) Image viewer — attach handler for chat message images (richMd.tsx renders img?) + composer preview tap. Plan: create src/components/ImageViewer.tsx overlay (fixed z-[70], img tag with object-contain, close X button + backdrop click). Message images: render img with cursor-pointer + onClick open viewer (check where images render — richMd.tsx or chat render). Composer preview: pickImage creates data URL, preview shows img thumbnail near composer — add onClick. (4) Typecheck/tests, checkpoint, deliver.
Prev checkpoint: 72097434. Live: aichatapp-8ksusdph.manus.space.


## Batch 59 progress update 3
DONE additions:
- ImageViewer.tsx created in src/components/: fullscreen overlay z-[80], backdrop click closes, Close button top-right (X + "Close"), zoom in/out buttons (0.5-3x), Reset, Escape closes zoom (setZoom(1)). Exports { ImageViewer } (src, onClose).
- ChatScreen.tsx: imported ImageViewer; added viewerSrc state (line ~117); composer preview imgs (both home ~line 441-446 and in-chat ~line 701-706) now onClick setViewerSrc(image), cursor-pointer; user msg image (line ~996-1003) + assistant msg image (line ~1067-1074) onClick setViewerSrc(msg.image), cursor-pointer.
TODO remaining: (a) Render <ImageViewer src={viewerSrc} onClose={() => setViewerSrc(null)} /> at the very end of ChatScreen root — root ends at line 781 (`</div>` closes flex col; `{image && ...}` composer ends ~780, then `</div>` root closes ~782). Check exact closing braces: outer `<div className="flex h-full flex-col">` ends right before `); }` of ChatScreen (line ~783). Place viewer just before last two `</div>` closing or after them (fixed overlay, position fine). (b) Typecheck + tests (99 prior). (c) Checkpoint + deliver (prev: 72097434). Live: aichatapp-8ksusdph.manus.space.
NOTE: user's last requests all included in batch 59 todo.md items (long-press menu, theme toggle DONE, share verify, image viewer).


## Batch 60 progress notes
DONE:
- export.ts: added chatToWhatsAppText(chat) (bold *title*, *You*/*Asky* labels, > quote lines, _italic_ markers, timestamps, [image attached], [error], [thought]) + exportChatToWhatsApp(chat) (downloads _whatsapp.txt + clipboard copy; returns {downloaded,copied}).
- Sidebar.tsx: imported exportChatToWhatsApp; added handleExportWhatsApp(chatId); ChatRow has onExportWhatsApp prop (3 call sites wired, line ~260/297/335); context menu has "Export for WhatsApp" item (LinkIcon) before Delete.
- tests/export-whatsapp.test.ts: 4 tests pass.

TODO batch 60 remaining:
1. DONE WhatsApp export (menu item + handler + tests). 2. DONE shortcuts section in SettingsModal (Ctrl+K new chat, Ctrl+/ focus, Esc, ArrowUp edit-last) + ArrowUp keybinding added to both composers. 3. DONE swipe gestures in ChatRow (swipe-left delete via confirm, swipe-right open, 70px threshold, vertical move cancels).
4. Typecheck clean + 103 tests pass. Next: mark todo items [x], save checkpoint, deliver in Hinglish with link aichatapp-8ksusdph.manus.space. No suggestion lists in final reply.
Prev checkpoint: 94259334. Live: aichatapp-8ksusdph.manus.space. User speaks Hinglish; no next-step lists in replies.

## Batch 61 progress (2026-08-18)
- [DONE] OfflineNotice.tsx converted: full-screen page -> slim fixed top banner (z-80), chats still readable offline, Retry button reloads.
- [DONE] titlegen.ts: system prompt now says write title in SAME LANGUAGE as user's messages.
- [CHECK] Pin toggle already exists in chat row 3-dot menu (line 637 "Pin/Unpin") — no change needed.
- [REMAINING] 1) Chat row hover timestamp (chat.updatedAt -> "X mins ago") next to msgs count. 2) Composer ArrowUp shortcut badge hint when input empty in active chat. 3) Delete icon should appear on mobile too (currently sm:opacity-0) — keep as is (mobile always shows). Actually mobile shows it (opacity-100 default). 4) Typecheck + tests, mark todo [x], checkpoint, deliver.
- Live: aichatapp-8ksusdph.manus.space. Prev checkpoint: b08bb0b2. User: Hinglish, no suggestion lists at end.

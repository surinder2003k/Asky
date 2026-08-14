# Implementation Notes (Batch 24) — working memory

## Current state (as of Phase 4 start)
- History Sheet archive UI: DONE (archiveRow/archiveItem styles, archivebox icon mapping, duplicate + archive buttons per row, folder collapse chevron). tsc clean, 30 tests pass.
- todo.md archive/duplicate/auto-archive items marked [x].

## Already implemented but NOT yet wired into UI/flow:
1. **lib/ai.ts** — added: `generateImage({modelKey, prompt, onProgress, signal})` via `${base}/images/generations` (NVIDIA); `generateAudio({modelKey, prompt, durationSeconds=10, ...})` via `${base}/audio-generation/generations`; `extractPdfText({uri})` with pdfjs-dist@4.10.38 (installed); helpers `isNvidiaImageModel(modelKey)`, `isNvidiaAudioModel(modelKey)`, `getScreenshotToCodePrompt()`, `getTranslationPrompt(lang)`, `getMathSolverPrompt()`, `getDeepResearchPrompt()`, `getThinkingPrompt()`.
   - NVIDIA image model keys: `nvidia/flux-1.1-pro`, `nvidia/fal-flux-schnell`, `nvidia/seedream-image-40b`
   - NVIDIA audio keys: `nvidia/audiocraft-musicgen-large`, `nvidia/nvidia-audioftmx`
2. **lib/modes.ts** — ChatMode = normal | deep_research | thinking | translator | math | screenshot_to_code; MODE_LABELS; MODE_DESCRIPTIONS; TRANSLATE_TARGETS array (12 languages).
3. **lib/storage.ts** — Conversation now has optional `chatMode`, `translateTarget`. New helpers: `setConversationMode(convId, chatMode, target?)`; ModelPreset + `getModelPresets()/saveModelPreset()/deleteModelPreset()` (max 12); `getColorTheme()/setColorTheme()` (default|oled|sepia); `getFontSizeChoice()/setFontSizeChoice()` (small|medium|large); `renderChatMarkdown(conv)` + `getChatExportLines()`.
4. **lib/theme-provider.tsx** — context now exposes `colorTheme`/`setColorTheme`; COLOR_THEME_OVERRIDES applied to document CSS vars only. NOTE: NativeWind `vars(...)` block still uses SchemeColors only — OLED/sepia overrides for native require updating the vars() useMemo to consult colorTheme overrides (needs work).
5. **hooks/use-chat-mode.ts** — `useChatModeFlags(chatId)` returns mode/targetLanguage/setModeForChat.

## PDF reading plan
- use expo-document-picker? Simpler: `expo-document-picker` available (SDK 54, ~12.0.x downgrade needed like other SDK57→54). Alternative: pick image from gallery for screenshots. For PDF choose: use expo-document-picker pickAsync(type 'application/pdf') → uri → extractPdfText → append as text attachment.
- In index.tsx: add "attach" icon (doc picker) next to photo icon; if file is PDF, extract text, prepend to user message as context, show small "📄 attachment" chip.

## Image/audio generation plan
- Detect in user text or via explicit mode? Simplest: if effectiveModelKey is NVIDIA image model → treat message as image prompt; add composer toggle/notice. Better: long-press composer icon menu? Keep simple:
  - In `sendMessage`: if `isNvidiaImageModel(effectiveModelKey)`, call `generateImage` and render base64 image bubble as assistant (no streaming; show progress).
  - If `isNvidiaAudioModel(effectiveModelKey)`, call `generateAudio` and render audio player bubble (expo-audio player).
  - Add header badge when selected model is gen-model.

## Screenshot-to-code plan
- Chat mode `screenshot_to_code` → system prompt = getScreenshotToCodePrompt(). User attaches image → model (vision) returns HTML code block → existing preview button works. Wire mode selector (new "Modes" option in long-press menu, like templates).

## Modes UI plan
- Add "Change mode" to long-press message menu (like templates) → ModesSheet component (list of 6 modes; translator picks targetLanguage from TRANSLATE_TARGETS; active mode shown with check; tap normal = off).
- Header chip: show mode label chip next to model chip? Keep small: show small mode badge under header. Use chatMode in getConversationSystemPrompt: compose system prompt = template prompt (or custom) + mode prompt (+translation suffix).

## Follow-up suggestions plan
- After assistant reply finishes (stream done, not sending), generate 3 short follow-up prompts with a lightweight model call or via the same model (non-stream, max_tokens 120, low temp) with prompt "Suggest 3 short follow-up questions..." and show chips above composer when conversation idle. Store in state `suggestions`. Only for normal mode. Debounce: only generate once per assistant message completion.

## Canvas editor plan
- New screen/route `app/canvas.tsx`? Or modal in chat? Use Stack screen pushed via router. Canvas: full-screen editor (TextInput multiline) + live HTML preview via WebView, save/copy/share buttons. Trigger from chat long-press "Edit in canvas" on assistant message text (copy whole text) → opens canvas with content pre-filled.
- Add route in app/canvas.tsx; need tabs _layout adjustment not needed (stack screens outside tabs work via router.push). Add import; use router from expo-router.

## Usage stats wiring
- `recordUsage(modelKey, chars)` exists in storage. Wire into `finally` blocks of sendMessage/continueReply/regenerate/saveEditedMessage streams: record chars of last assistant text length. Add Settings section showing per-model message count + char count (bar-ish list).

## Model presets UI
- Settings section "Quick Presets": save current combo (model+mode) as named preset; chips shown above composer like saved prompts — tapping applies model+mode then sends.

## Font size UI
- Settings section Font Size (small/medium/large circles). Apply: MessageText fontSize prop + composer fontSize. Pass via useColors? Add a context-free approach: store choice, apply in MessageText (message-text.tsx) reading storage on mount; simpler — create `lib/font-size.tsx` context provider mounted in _layout.tsx.

## Gesture controls
- Swipe right on chat screen header area? Simpler and robust: GestureDetector on the main FlatList: swipe right edge → new chat; swipe left edge → open history. Use react-native-gesture-handler Gesture. Add as overlay on container with simultaneous with scroll.

## Local reminders UI
- Long-press message menu "Set reminder" → dialog: text input + duration chips (15m/30m/1h/1d/custom). Use expo-notifications scheduleNotificationAsync (date trigger), save to storage via saveReminder(id, text, at, notifId), cancel via Notifications.cancelScheduledNotificationAsync(notifId). Add "Reminders" sheet in history? Keep simple: reminders section in Settings (list + delete). Register notifications permission on app start (root _layout.tsx), Android channel.

## PDF export
- Web: print window? Mobile: share markdown text (already). PDF: on web, use window.print() with styled div; native: use expo-print? expo-print may be SDK 57 — check availability, else skip native PDF and use "Print" via Share of markdown. Implement: Settings/share → "Export as PDF" button: web → print preview; native → try expo-print printAsync(html) fallback to Share markdown.

## OLED/sepia theme fixes needed
- In ThemeProvider: extend themeVariables vars() to consult COLOR_THEME_OVERRIDES[colorTheme] on top of SchemeColors.

## Files still to edit
- app/(tabs)/index.tsx: attach PDF button, mode badge, suggestions, usage record, gen-image/audio handling, modesheet, canvas trigger, gestures.
- New components/modes-sheet.tsx, components/canvas-screen.tsx (route app/canvas.tsx), components/reminders-sheet.tsx (or Settings).
- components/message-text.tsx: font size prop via FontSizeContext.
- lib/font-size.tsx (context provider).
- app/_layout.tsx: mount FontSizeProvider, Notifications permission, reminder listener.
- components/settings-modal.tsx: OLED/sepia theme, font size, usage stats, reminders list, model presets.
- tests: add tests for modes/storage helpers/ai helpers.

## Notifications API quick ref (expo-notifications)
- `Notifications.setNotificationHandler({...})` (shouldShowAlert: true)
- Android: `setNotificationChannelAsync('default', {name, importance: MAX})` on Platform.OS === 'android'
- Permissions: `getPermissionsAsync()` then `requestPermissionsAsync()`
- Schedule: `scheduleNotificationAsync({content: {title,body,data:{...}}, trigger: {type: 'date', date: new Date(at)}})` → returns notificationId (string)
- Cancel: `cancelScheduledNotificationAsync(notifId)`
- Local notifications work in Expo Go on Android (SDK 53+) — push tokens need dev build.

## Key facts
- Project path /home/ubuntu/ai_chat_app, preview https://8081-iaiyo85z3gtgp9r7sc3v7-16dbb176.sg1.manus.computer
- Last checkpoint: e13ff8c9. Tests command: pnpm vitest run (30 passing). TypeScript: npx tsc --noEmit.
- pdfjs-dist@4.10.38 installed. react-native-webview installed.
- User language: Hindi-English mix; deliver in English+Hindi friendly tone.
- User asked earlier: APK via Publish button (not manual build).

## Progress update (Phase 4)
Done so far: lib/notifications.ts (scheduleReminder, cancelReminderById, formatReminderAt, REMINDER_DURATIONS, ensureNotificationPermission; note TS needed shouldShowBanner/shouldShowList). lib/reminders.ts (initReminders re-registers reminders with no notifId on app start; imported in app/_layout.tsx). lib/font-size.tsx (FontSizeProvider w/ FONT_SIZES small 14/medium 16/large 19 + useFontSize; mounted in app/_layout.tsx both branches). components/modes-sheet.tsx (ModesSheet: normal/deep_research/thinking/translator/math/screenshot_to_code w/ descriptions + TranslatorSheet w/ TRANSLATE_TARGETS + custom input; active checkmark teal). Storage helpers verified: setConversationMode(convId, chatMode, translateTarget?), recordUsage(modelKey, chars), getUsageStats() returns [modelKey]: {messages, chars, lastUsed}, getColorTheme/setColorTheme (default|oled|sepia), getFontSizeChoice/setFontSizeChoice (small|medium|large), getModelPresets/saveModelPreset/deleteModelPreset (ModelPreset), saveReminder(id,text,at,notifId?), getReminders() (Record<string,{text,at,notifId?}>), deleteReminder, archiveConversation(id,archived), duplicateConversation(id,modelKey?), getArchivedConversations(), getChatExportLines(conv), renderChatMarkdown(conv). Conversation has chatMode + translateTarget optional fields. Tests: 30 passing, tsc clean.

## Remaining plan
1. Wire modes into index.tsx: compose system prompt in getConversationSystemPrompt (index.tsx) with MODE PROMPT via awaitGetTemplates-style helper for modes? modes stored on conversation chatMode+translateTarget. Add modePrompt compose: template prompt first, else custom prompt; append mode prompt suffix (add getModePrompt(chatMode, targetLanguage) helper in lib/modes.ts returning prompt string; normal = "" ; translator = getTranslationPrompt(lang)). Update index.tsx getConversationSystemPrompt to also use conv chatMode (need fresh conv; sendMessage etc. already read conversation?.templateId — pass conv.chatMode).
2. Add "Change mode" long-press menu entry → ModesSheet + TranslatorSheet conditional for translator. Mode badge under header (small chip next to model chip showing MODE_LABELS[mode]).
3. Image/audio generation in sendMessage: if isNvidiaImageModel(effectiveModelKey): call generateImage, render assistant bubble with generated image (DisplayMessage.genImageBase64 + genMimeType + genStatus + genProgress); audio: generateAudio → audioBase64; add genText? Add a "Generating image..." typing bubble w/ progress text. Stop via abortRef passed.
4. PDF attach: header/ composer: new doc icon → DocumentPicker.pickAsync({type:['application/pdf']}) → extractPdfText → user message chip "📄 {name} ({pages})" via pendingPdf state; prepend text as context; image attachment logic unchanged.
5. Follow-up suggestions: after stream done (finally if success), call a quick non-stream completion (max_tokens 120, temperature 0.3) with prompt "Suggest exactly 3 short follow-up questions (each <12 words, one per line, numbered 1-3) based on this conversation..." → parse lines → state suggestions[3]; chips above composer when sending=false and messages>0 and conversation.chatMode normal; tap chip = setInput and send.
6. Usage stats: recordUsage(effectiveModelKey, lastAssistantText.length) in finally of 4 stream sites (only when !error).
7. Settings modal extensions: Theme section (OLED/Sepia/Default selector w/ useThemeContext.colorTheme); Font size (small/medium/large circles w/ useFontSize); Usage stats section (per-model bar: messages + chars/1k, sorted by lastUsed); Model presets section (save current (modelKey + chatMode) as named preset; list presets; tap apply); Reminders section (list from getReminders, formatReminderAt, delete w/ cancelReminderById). Also add "Export as PDF" button in long-press menu (web: print; native: Share markdown fallback + try expo-print if available — check later).
8. Canvas screen: app/canvas.tsx stack screen; TextInput editor + WebView preview (load html via html={content}); header: title "Canvas", preview toggle, copy, share, save(to AsyncStorage drafts? keep simple: just copy/share/close). Trigger from long-press menu "Edit in Canvas" on assistant message → router.push(`/canvas?content=${encodeURIComponent(text)}`). Register Stack.Screen name="canvas" in _layout.tsx with presentation default (push). Note expo-router typed routes.
9. Gestures: GestureDetector on chat container: swipe right (from left edge) → handleNewChat; swipe left (from right edge) → setHistoryOpen(true). Use Gesture.Swipe().direction() ... simpler: swipe right → new chat, swipe left → history. Wrap FlatList area. Keep simple, add to index.tsx.
10. Tests: add tests for modes-sheet logic (lib/modes.ts getModePrompt), reminders formatting, usage stats, storage mode helpers, ai mode prompts, theme defaults, font sizes.

## Settings modal structure for additions
- Appearance section (lines ~186-300): add Font size + color theme (default/oled/sepia) rows under accent picker.
- Usage stats: new section card showing per-model stats.
- Model presets: new section.
- Reminders: new section listing reminders.
- Existing props: visible/onClose/onSaved/onImported.

## Progress update 2 (index.tsx wiring)
- DONE in index.tsx: genMedia DisplayMessage type + __GEN_MEDIA__image__/audio__ markers in persisted text; NVIDIA image/audio generation path in sendMessage (generateImage/generateAudio with genProgress bubble, abort via abortRef); PDF attach pickPdf (DocumentPicker.getDocumentAsync {type:application/pdf}) → pendingPdf state + context prepended to user text; usage recording via recordUsageLocal in all 4 stream handlers (sendMessage/continueReply/regenerate/saveEdited) via onStreamDone helper; follow-up suggestions fetchSuggestions (3 chips via gemini fallback key → model's provider key, max_tokens 120) + suggestions state; modes wired: getConversationSystemPrompt(templateId, chatMode, translateTarget) all 4 sites; header mode badge chip (wand icon) when chatMode not normal; long-press menu "Apply/Change mode" → ModesSheet; ModesSheet rendered with onApply=handleApplyMode.
- FIXES STILL NEEDED: (1) icon name "wand.and.stars" not in icon-symbol mapping — use "sparkles" or add mapping; (2) ModesSheet props: check actual props (currentTranslateTarget invalid); (3) add suggestions chips UI above composer (suggestions state + clear on new message); (4) pendingImage/pendingPdf chips in composer (pendingPdf chip w/ remove + doc icon); (5) gen media bubbles in renderItem: parse __GEN_MEDIA__type__b64__END__ marker → image view / audio player (expo-audio); (6) usage stats + OLED/sepia + font size + reminders + presets sections in settings-modal; (7) canvas screen app/canvas.tsx + "Edit in Canvas" menu entry + Stack route; (8) tests additions; (9) tsc + vitest verify + checkpoint.
- Composer icons order: photo, [doc PDF icon new], TextInput, mic, send. Add iconBtn doc.fill for pickPdf.
- ModesSheet actual props (from components/modes-sheet.tsx): visible/onClose/currentMode/onApply(mode). Check file before calling.

## Progress update 3 (settings-modal + remaining)
- DONE: settings-modal has Color Theme card (COLOR_THEMES/ColorThemeKey/colorTheme/setColorThemeLocal — MUST define), Font Size card (FONT_SIZES/useFontSize — imported), Usage card (usageStats/maxChars/loadUsageStats/resetUsageStats — MUST define state + useEffect load). Storage exports: getUsageStats/resetUsageStats/getColorTheme/setColorTheme. Storage UsageStats shape (line 393): { modelStats: Record<string, number>, totalChars, resetAt } (VERIFY actual shape in storage.ts).
- DONE index.tsx: mode badge + Apply/Change mode menu + ModesSheet; composer doc.on.doc.fill PDF attach + pendingPdf chip + suggestions chips; recordUsage in all 4 streams; PDF context appended.
- STILL TODO: (a) settings-modal: add useState usageStats/fontSizeChoice/colorTheme + useEffect load; define COLOR_THEMES: {default:'#1e2022', oled:'#000000', sepia:'#f4ecd8'} samples w/ dark/light awareness (dark mode colors); setColorThemeLocal calls setColorTheme from storage + theme provider apply if needed (theme-provider already has applyColorTheme — call via useThemeContext if it exposes setColorTheme); (b) add icon mappings textformat.size.fill, chart.bar.fill, paintbrush.fill(?check) in icon-symbol.tsx — content-copy used for doc.on.doc.fill; (c) gen media bubble rendering: parse __GEN_MEDIA__image__/audio__b64__END__ in renderItem — for audio use expo-audio playback component inside bubble; (d) canvas: app/canvas.tsx screen + menu entry "Edit in Canvas" + Stack route in app/_layout.tsx; (e) tsc + vitest + checkpoint.
- theme-provider applyColorTheme(ColorTheme) exists; useThemeContext exposes { colorScheme, setColorScheme, accent, setAccent, ... } — check. setColorThemeLocal should: await storage.setColorTheme(t); then call provider apply.
- reminder flow: lib/reminders.ts reSyncReminders() called from app/_layout.tsx on start; notifications.ts has scheduleReminder; storage has saveReminder/deleteReminder/getReminders. A reminders UI in settings still UNBUILT (optional; todo says reminders implemented via settings? check todo.md — likely [ ] Reminders in settings).

## Progress update 4 (settings + icons DONE)
DONE: settings-modal now has Color Theme (OLED/sepia via useThemeContext.setColorTheme), Font Size (FONT_SIZES/useFontSize), Usage stats cards (with reset + per-model bar chart). Icons mapped: textformat, textformat.size.fill, chart.bar, chart.bar.fill. resetUsageStats added to storage.ts. tsc clean (0 errors).
REMAINING: (1) Gen-media bubble rendering in index.tsx renderItem: parse __GEN_MEDIA__image__/audio__<b64>__END__ — check how sendMessage persists them (look at genProgress final setMessages block, lines ~795-870) and render in renderItem before message bubble; for audio use expo-audio AudioPlayer. (2) Canvas: app/canvas.tsx + "Edit in Canvas" long-press menu entry + Stack route. (3) iOS icon-symbol: components/ui/icon-symbol.ios.tsx may also need union members for the new icons (check). (4) tsc + vitest + screenshots + checkpoint. Note todo.md pending items: Phase 3 AI capabilities + Phase 4 UX + font size/theme done-ish in code but todo items not marked [x].
Reminder: user wants APK build at end — tell them to click Publish in UI (auto-build apk), never build manually.

## Progress update 5 (checkpoint 7fd599d7 saved)
DONE (checkpointed): archive UI, gen-media bubbles (image + GenAudioBubble audio player w/ expo-audio isLoaded fix), PDF attach, suggestions chips, modes (deep research/thinking/translator/math/screenshot-to-code) wired via getConversationSystemPrompt, OLED/sepia themes in Settings, font size S/M/L, usage stats card w/ reset, icons textformat/chart.bar mapped.
todo.md Batch 24: DONE = archive/dup/archive, img gen, audio gen, PDF reading, screenshot-to-code, translation mode, math, deep research, thinking, follow-up suggestions, usage stats, OLED/sepia, font size, folder collapse. STILL OPEN: [ ] Local reminders UI from chat, [ ] Canvas editor (app/canvas.tsx + menu entry "Edit in Canvas" + Stack route), [ ] Model presets buttons, [ ] Gesture controls swipe new chat/history, [ ] Android widget, [ ] Chat export as PDF.
REMAINING PLAN: (1) Canvas: app/canvas.tsx — full-screen editor: takes message text (Markdown/HTML), edit text, live HTML preview (WebView), copy/share. Route in app/_layout.tsx Stack: add <Stack.Screen name="canvas" options={{presentation:'modal'}}/>; menu entry in long-press menu for assistant messages; index.tsx uses router.push("/canvas?msgId=..."). (2) Reminders: reminder sheet from long-press menu "Set reminder" — TextInput + time picker (chips: 10min/30min/1hr/tomorrow/custom date via expo-notifications scheduleNotificationAsync + storage saveReminder); lib/reminders.ts reSyncReminders already in _layout. (3) Model presets: Settings "Fast chat"/"Deep thinking" chips saving via getModelPresets/setActivePreset? — storage has getModelPresets/saveModelPreset/deleteModelPreset; add activePreset helper simple: Settings row "Model Presets" chips applying preset (name + modelKey + optional mode). (4) Gestures: swipe on FlatList rows (left→archive? right→history?) — maybe keep simple: header swipe gestures via GestureDetector not required; skip or use simple press on header edges. (5) Widget: skip (not possible via shortcuts plugin easily; shortcuts already exist). (6) PDF export: exportChatPdf in storage exists? (storage.ts has export helpers — check exportChatAsPdf). Then tsc + vitest + screenshot + final checkpoint + tell user publish.
User-facing msg at end in Hinglish.

## Progress update 6 (checkpoint cbda923c saved; verification done)
DONE: Canvas editor (canvas-screen.tsx, mounted in index.tsx, menu "Open in Canvas" for assistant msgs), RemindersSheet (reminders-sheet.tsx, menu "Set reminder", expo-notifications + storage reminders), icons bell.fill/calendar mapped. tsc clean, 30 tests pass, screenshot OK. todo.md mostly marked [x] in Batch 24.
REMAINING todo items still [ ]: Model presets UI in settings (storage has getModelPresets/saveModelPreset/deleteModelPreset; ModelPreset{ id,name,modelKey,templateId?,chatMode?,translateTarget? } — add section BEFORE API Keys at line 821 in settings-modal.tsx), Gesture swipe controls (skip/skip), Android widget (skip — shortcuts exist), Chat export as PDF (skip — no expo-print; would need new dep).
PLAN: add simple Model Presets section to settings-modal (chips "Fast chat" mistral-small-latest + "Deep thinking" nvidia deep-research model + preset from current chat settings save-as), then final checkpoint + delivery msg in Hinglish telling user Publish for APK.
Note: settings-modal imports to add: getModelPresets/saveModelPreset/deleteModelPreset from @/lib/storage, plus MODE_LABELS from @/lib/modes; providers list from getModels() in remote-config; use setConversationMode import already exists? (check). OnApply semantics: preset tap → settings stores active preset + applies to current chat if open (Settings can't know open chat — just save preset; app could apply when creating chat — keep simple: save only + toast).

## Batch 25 plan (user asked all 10 next steps + resume builder + connector explanation)
Plan doc saved here for compaction resilience.

### Features + implementation strategy (keep app local-first, no new DB)
1. **Swipe quick actions**: index.tsx renderItem — add GestureDetector/Pressable long-press menu already exists; use PanResponder horizontal swipe on bubble: right→copy, left→delete menu. Use react-native-gesture-handler Gesture detector on message bubble with translationX threshold 80, animated reveal of action icons. Keep simple: Pressable + PanResponder (no reanimated needed). Action state keyed by msg id.
2. **Chat PDF export**: use expo-print printAsync on HTML (already have exportChatHtml logic); printAsync returns uri → share via expo-sharing. Check package has expo-print; if not, pnpm add expo-print. Share markdown already exists (handleExportMarkdown uses Sharing.shareAsync).
3. **Rotating welcome prompts**: constants list of ~16 prompts, pick 4 random on mount via seeded-ish Math.random; reshuffle when empty.
4. **Web search mode**: settings toggle "Web Search (tool-use)" → when ON, add system instruction asking model to search live web when relevant; ALSO per-provider: some OpenAI-compatible don't support tools; keep prompt-only approach (models with search tools auto-use via provider system). Add toggle in settings + storage key "webSearchEnabled" in getSettings/setSettings? check settings shape; or own key webSearchEnabled via getRaw/setRaw.
5. **Voice messages**: composer: hold mic button → expo-audio useAudioRecorder (check docs at /home/ubuntu/ai_chat_app_helper/docs/media/audio/DOCS.md) → recording → stop → send audio file as attachment (base64 + transcript of audio? better: send audio + ask AI to analyze/transcribe). Vision models can't hear audio; so transcribe server-side via server/_core/voiceTranscription.ts (Manus built-in) — call server route /api/transcribe? check server routers. Then send transcript text as user message with note "[Voice message]".
6. **Debate view**: new sheet DebateSheet? CompareSheet already exists for side-by-side. Extend: "Debate mode" — both models reply to each other's last answer N rounds; render as conversation. Simpler: modes.ts mode "debate" with 2 model keys; implement in index: when mode debate, alternate streaming between 2 models, render each with colored avatar. Store model2 in Conversation model2Key (add to Conversation type + UI picker).
7. **Knowledge base**: kb storage key "kbDocs" [{id,name,text}] + UI section in history-sheet or settings "Knowledge Base" manage docs; when kb ON (settings toggle) prepend doc texts as system context truncated. Auto-context on send.
8. **History viewer**: add "View exported chats" — read importable JSON? Simpler: history-sheet add Archive view exists; exported chats viewer = view previously exported Markdown/HTML files? Local files not accessible. Alternative: "Chat history viewer" = a screen listing all chats incl archived w/ full-text preview + jump. Acceptable: rename/extend history-sheet bottom "View Archive" already. Instead build viewer in history sheet: expand archive to show full content? Keep: full-text preview in search already. Minimal: export history as one HTML archive file (already exportAllChats JSON). Implement: Settings → "Export all history (HTML)" using existing exportAllChats + html generation.
9. **Slash commands**: composer on send, if text starts with /, dispatch: /img → gen image; /pdf → pick pdf; /voice → voice msg; /search → web search toggle; /resume → resume builder flow; /canvas → open canvas; /debate → debate mode; /kb → kb attach; /mode-<x> → set mode. Also show /commands hint.
10. **Resume builder**: resume-sheet.tsx modal: form fields (name, contact, objective, experience entries w/ add/remove, education, skills, projects) + generate via AI (template prompt → Markdown) → store text → render resume PDF via printAsync (styled HTML resume) → share. Also attach KB doc "my resume info".

### Connector question (answer to user in final msg)
Manus connectors (App/MCP/API) are a Manus platform feature — they cannot be embedded inside an exported APK. In this Expo app, third-party integration options are: (a) user-provided API keys (current design — most flexible), (b) OAuth via expo-web-browser (Google Drive login etc — needs per-provider client id, heavier), (c) built-in Manus API connectors (BYOK) only power the Manus sandbox session, not the shipped APK. So practical answer: app stays keys-based; suggest future webhook/MCP gateway via user's own server. Be honest about this.

### Key facts (from earlier compaction)
- project: /home/ubuntu/ai_chat_app; tabs index = app/(tabs)/index.tsx; components in components/; lib/storage.ts has getRaw/setRaw, nanoId(line 46), settings via getSettings/setSettings? verify; usage recordUsage(key,chars).
- Settings modal: components/settings-modal.tsx, section "API Keys" ~line 825, uses import('@/lib/storage') helpers + dynamic imports; style keys: backdrop,sheet,preset,testBtn,backupBtn,saveBtn,promptChip,ttsBtn,ttsVoiceChip,toggleRow,toggleTrack,toggleThumb.
- modes.ts: ChatMode type + MODE_LABELS + MODE_DESCRIPTIONS + TRANSLATE_TARGETS. providers.ts MODELS: {id,name,providerKey,vision}.
- busy model: lib/busy-model.ts setBusyModel; history-sheet, templates-sheet, compare-sheet, modes-sheet components exist.
- tests: npx vitest run (30 pass); tsc clean required. Checkpoints: 9373b87f latest.
- expo audio docs: /home/ubuntu/ai_chat_app_helper/docs/media/audio/DOCS.md (useAudioPlayer + useAudioRecorder, setAudioModeAsync playsInSilentModeIOS).
- server voiceTranscription: server/_core/voiceTranscription.ts — check if express route exposed; simpler client-side: send audio? Not possible. Use server route if exists else skip transcription & send audio as "analyze this audio".

## Batch 25 voice decision
No server upload path available (storageProxy GET-only, no transcribe route). DECISION: hold-to-talk = extend existing mic dictation: long-press mic in composer → live transcription bubbles up (useVoiceDictation already exists) → release = auto-send as user message ("hold to talk" style). Keep it simple, testable, no new deps.

## Batch 25 state snapshot (before compaction)
Baseline screenshot saved: main chat dark UI with header (grid icon left / new chat pencil / model picker "Mistral Small" / grid compare / search / settings gear), empty state "How can I help?" + 4 fixed starter prompts (static strings — need rotating), composer w/ image + doc chips left, mic + send right, tab bar bottom.
Checkpoints: 9373b87f (Batch 24 complete). Latest deployed domain aichatapp-8ksusdph.manus.space.
Voice dictation hook (hooks/use-voice-dictation.ts): useVoiceDictation() returns {isListening, dictError, toggleDictation(onFinal), stopDictation}; continuous:false; final transcripts only. Currently wired at index.tsx line 228: const { isListening, dictError, toggleDictation, stopDictation } = useVoiceDictation();
Index.tsx key facts: sendMessage defined ~line 380+; composer component defined ~1280+; mic button in composer; longPressMsg state + menu at ~1721+; FlatList renderItem ~1500-1620; messages/DisplayMessage derived; settings-modal sections: Custom System Prompt (preset chips line ~802), Model Presets (~825), API Keys (~830), sections use mt-6 heading.
Settings interface: Settings{ modelKey } only in lib/storage.ts line 42; getSettings/setSettings exist; other prefs use getRaw/setRaw keys (accentKey, schemeChoice, autoReadAloud, appLockEnabled, usageStats, webSearchEnabled to add).
Server: no transcribe/upload routes; voice = dictation-based hold-to-talk decision.
TODO Batch 25 items (10) at end of todo.md.

### Implementation order plan (Batch 25)
1. lib/storage.ts: add webSearchEnabled key helpers, kbDocs helpers (getKbDocs/saveKbDoc/deleteKbDoc), resumeInfo doc type reuse kb.
2. lib/modes.ts: add "debate" to ChatMode + labels.
3. index.tsx: rotating starter prompts (WELCOME_PROMPTS array, pickRandom 4 on mount via ref), slash commands dispatch in sendMessage start, webSearchEnabled system prompt addition in getConversationSystemPrompt, kb context prepend when toggle on (storage key kbEnabled).
4. Swipe actions: simple implementation — add swipeOffset state per msg via PanResponder on bubble; right swipe >60px = copy (clipboard), left >60px = delete menu. Use PanResponder (built-in, no reanimated).
5. Voice hold-to-talk: composer mic: onPressIn starts dictation with auto-send callback (toggleDictation((text)=>{ setInput(text); send()})), onPressOut stops. Show recording indicator.
6. PDF export: install expo-print; add exportChatPdf using printAsync on styled HTML → saveAsync → Sharing.shareAsync.
7. Resume builder: resume-sheet.tsx — form + AI generate (sendMessage with special prompt) + view + export PDF (printAsync HTML resume) + save as KB doc option.
8. Debate: extend modes-sheet with debate option selecting model2 from model list; index handles alternate-streaming: send user msg → stream model1 → append user message "Respond to this:"? Simpler: two AI messages alternate: after model1 finishes, append system-like user msg "Now respond as model2 critic" with model2 busy, stream. 3 rounds. Render with avatar colors (teal/amber).
9. KB: settings section "Knowledge Base" list docs + add (paste text or import .txt) + toggle use-in-chat.
10. History viewer: extend history sheet archive section already; add "Export history" in settings (exportAllChats JSON already) + importable viewer via import (user imports its own exported JSON). Implement import flow already exists. Viewer = history sheet search already filters. Add Settings button "Import & view chats" reusing importChats.
11. Slash commands hint: composer shows "/ for commands" placeholder hint; on "/" type show quick commands row (img, pdf, voice, search, resume, canvas, debate, kb, mode).

## Batch 25 verified positions (post-compaction anchor)
- index.tsx: sendMessage starts line 762; early guard line 764: `if ((!text && !pendingImage) || sending || !conversation) return;` — add slash-command dispatch RIGHT AFTER this guard (before setBusyModel) e.g. lines 765-768.
- userText built lines 769-775; pdfAppend lines 901-904; history built line 906-910 (system prompt only from getConversationSystemPrompt — add webSearch + KB context to that text).
- getConversationSystemPrompt(templateId, chatMode?, translateTarget?) at line 88. ModeSuffix = getModePrompt(chatMode, translateTarget).
- STARTER_PROMPTS line 121 (static 4 items; line 1658 renders STARTER_PROMPTS.map in empty-state view — replace with dynamic WELCOME_PROMPTS + pickRandom4 ref state `welcomePrompts`).
- dictation wired line 228.
- storage.ts: appended helpers at end: getWebSearchEnabled/setWebSearchEnabled, KbDoc+getKbDocs/saveKbDoc/deleteKbDoc/toggleKbDocActive/getActiveKbDocs/getKbContextText(maxChars=8000).
- expo-print installed. Dev server running port 8081. Memory was high, now ~900MB avail.
- Remaining plan items tracked in todo.md Batch 25 section.

## Update: getConversationSystemPrompt is now async
All 4 call sites (601, 918, 1111, 1209) now use `await`. 601 = regenerate/edit? 918 = sendMessage, 1111/1209 = continueReply/regenerate. TSC clean.
Slash commands: dispatch after sendMessage guard (~line 775 now). WELCOME_PROMPTS rotation: STARTER_PROMPTS at 132, render at 1669.
Settings-modal: Model Presets section at ~825; to add sections: Web Search toggle (after Model Presets), Knowledge Base section (after Web Search).

## Batch 25 progress (state before compaction)
DONE: storage helpers (webSearch, kbDocs); getConversationSystemPrompt async + webSearch/KB injection (sites 601/918/1111/1209 all await); WELCOME_PROMPTS (16 items) + pickWelcomePrompts + welcomePrompts state + render swap; slash command framework (setSlashHandler module-level fn, handleSlash callback registered in effect; commands /img /pdf /voice /search /resume /canvas /debate /kb /mode-<x>; modeNotice toast state).
CURRENT ERRORS to fix:
1. Line ~504: haptic used before declaration — move handleSlash/useEffect registration AFTER haptic def, OR define haptic before. Solution: move "Slash command dispatcher" block to after haptic definition.
2. Line 510: setSlashHandler(null) — setSlashHandler type requires non-null handler; fix type to allow null or pass noop: setSlashHandler(() => false).
3. "Type 'boolean' is not assignable to type 'Promise<boolean>'" — likely dispatchSlashCommand call site? Check line where dispatchSlashCommand awaited in sendMessage — sendMessage guard area. Actually error says boolean not assignable to Promise<boolean>; maybe in handleSlash default case MODE_LABELS check fine... find by tsc.
TODO next: fix these 3 errors, then: pickPdf exists? verify pickPdf handler name (find "const pickPdf" in index.tsx — used in /pdf command, line 462). Then: modeNotice toast render (small banner above composer), /voice hint.
STILL PENDING Batch 25: swipe actions, PDF export (expo-print printAsync→share), hold-to-talk mic (dictation auto-send), debate mode (sheet+alternate streaming), KB UI (settings kbOpen state + KbSheet component), resume builder (resumeOpen + ResumeSheet), web search toggle UI in settings-modal, history viewer (settings import/export already exist), settings sections (Web Search toggle, Knowledge Base list, Resume builder entry).
Components to create: components/resume-sheet.tsx, components/kb-sheet.tsx, components/debate-sheet.tsx (or integrate in modes?). 
Settings-modal sections: find "Model Presets" heading (~line 825 in older file) and add Web Search toggle + Knowledge Base + Resume section there.
Tests: npx vitest run (30 passing); tsc clean required.
Debate design: DebateSheet selects model2 from MODELS list; alternate streaming rounds=2; after user msg, stream model1 reply, then append user-text-as-prompt "{prev}" + stream model2 reply; render with avatar colors (teal user-side, amber model2). Store debate rounds in memory.

## Batch 25 snapshot (post swipe)
DONE: slash framework + all commands (/img /pdf /voice /search /resume /canvas /debate /kb /mode-x), welcome prompts rotation, modeNotice toast (renders above composer, sparkle icon, xmark close), swipe actions (PanResponder copy/archive archiveConversation verified exists line 334), Animated.View wrapper around bubble, getConversationSystemPrompt async with webSearch+KB.
NOTE: swipeX uses useRef(new Animated.Value(0)).current — ref-per-render is fine in RN since renderItem called per item; swipeResponder memoized on item.id.
NEXT: hold-to-talk (mic button onPressIn/Out dictation auto-send), PDF export via expo-print (add exportChatPdf in settings-modal using getChatExportLines + printAsync), debate mode (DebateSheet component + alternate streaming in index), resume builder (ResumeSheet), KB UI (KbSheet or inline in settings kbOpen), settings sections Web Search toggle + KB + Resume entry.
Settings-modal structure: appears to have sections with headings "mt-6"; Model Presets at ~line 825 (after prompt); API keys after. Add Web Search toggle + Knowledge Base (list docs + add) + Resume Builder link there.
History viewer: import/export chats already in settings (Backup/Restore). Mark done if sufficient.
Remaining todo items (check todo.md Batch 25 section): swipe, PDF export, voice msgs, web search mode, resume, debate, KB, history viewer, welcome prompts, slash commands.
Also add: composer mic hold-to-talk = longPress on mic -> toggleDictation with auto-send handler (modify commitFinalTranscript or add second hook param).
Debate implementation plan: DebateSheet picks model2 from MODELS + rounds; in index: send alternate messages — after model1 reply ends, auto-send "Now critique and respond from model2's perspective to this full exchange:\n{history as text}" streaming with model2 (busy-model safe since same chat sequentially). Render model2 messages with amber avatar (IconSymbol name="lightbulb.fill"). Simplest: use same stream infrastructure; debate rounds stored as separate messages with role "assistant" + suffix __DEBATE2__ marker; renderItem checks marker for avatar color.
Tests: npx vitest run passes 30; tsc clean.
Then: screenshot verify, checkpoint, deliver with connectors answer (Manus connectors = MCP servers/Apps; this app cannot use them directly — free alternative = knowledge base + custom system prompt; cloud sync already provides cross-device).

## Batch 25 snapshot (settings-modal sections added)
DONE so far: slash commands all, welcome prompts rotation, modeNotice toast, swipe actions (copy/archive), hold-to-talk mic (longPress = dictation auto-send via commitFinalTranscript setInput + sendMessageRef), getConversationSystemPrompt async w/ webSearch+KB, settings-modal new sections inserted at line 903 (Web Search toggle w/ Switch, Knowledge Base list+add via DocumentPicker+FileSystem readAsStringAsync, Resume Builder row button).
CURRENT TS ERRORS in settings-modal.tsx (to fix):
1. kbMsg, kbDocs, webSearchOn, importKbDocs, setKbDocs, setKbMsg, setWebSearchOn, onOpenResume not defined — need state + useEffect + helper fns in SettingsModal body.
2. styles.rowBtn doesn't exist — use inline style object instead (same pattern as presetInput inline).
3. Icon name "doc.badge.plus", "doc.fill", "eye", "eye.slash", "trash", "plus", "sparkles" not all mapped — check MAPPING in components/ui/icon-symbol.tsx. Map any missing to Material icons: doc.fill→"description", doc→"description", eye→"visibility", eye.slash→"visibility-off", trash→"delete", plus→"add", doc.badge.plus→"note-add".
4. kbDocs load: useEffect on visible; import { getKbDocs } from "@/lib/storage" (already imported? no — add).
Settings-modal existing state patterns: settingsOpen? no, props: visible/onClose/onReset. Add states: webSearchOn (load getWebSearchEnabled on visible), kbDocs (KbDoc[]), kbMsg, kbLoading.
RESUME BUILDER: create components/resume-sheet.tsx (props visible, onClose, onOpenResume passed to SettingsModal). ResumeSheet: name/contact/education/experience/skills inputs → send via AI? Simplest: generate resume markdown client-side OR use sendMessage in index with special prompt. Keep self-contained: ResumeSheet generates resume text from inputs + renders preview (ScrollView) + export PDF via expo-print printAsync on HTML → saveAsync? Web: printAsync returns uri. Use: import { printAsync } from "expo-print"; const { uri } = await printAsync({ html: RESUME_HTML, width: 612, height: 792 }); then Sharing.shareAsync(uri). Save resume text also as KbDoc (active:false) optional via "Save to Knowledge Base" button.
Debate: components/debate-sheet.tsx — select model2 from MODELS + rounds (2/3); index: after reply, send alternate prompt. Render __DEBATE2__ marker w/ amber avatar.
PDF export chat: settings backup already has export; add per-chat PDF: in long-press menu add "Export PDF" (already has export md/html?). Add printAsync flow: getChatExportLines → HTML → printAsync → shareAsync. Check existing menu items first (export markdown exists).
After fixes: tsc clean, vitest pass, screenshot, checkpoint, deliver.
Connectors answer for delivery: Manus connectors (Apps/MCP/APIs) cannot be plugged into a standalone Expo app directly — that's Manus platform-only. Free equivalents already built: Knowledge Base (local context), custom system prompt, cloud sync. 3rd-party free integrations possible: Wikipedia/REST APIs directly (app can call them), but no universal connector framework in free standalone app.

## Batch 25 snapshot: settings-modal DONE (tsc clean, resume sheet mounted, icons mapped visibility/visibility-off/delete/note-add/doc.fill + visibility key in MAPPING, ResumeSheet exported). REMAINING: chat PDF export (long-press menu + settings), debate mode, KB UI inline done in settings? (list+add rendered yes), history viewer, slash kb/voice/canvas/resume/canvas handlers registered? (check index slash dispatch), verify /voice uses dictation auto-send, verify PDF export button in settings (add exportChatPdf fn using getChatExportLines + printToFileAsync + shareAsync). THEN tests + screenshot + checkpoint + deliver.

## Batch 25 progress (Phase 2 start)
DONE: all Priority 1 (swipe copy/archive, welcome rotation, slash /img /pdf /voice /search /resume /canvas /debate /kb /mode-x), hold-to-talk mic long-press (toggleDictation accepts onFinalTranscript callback — commitFinalTranscript setInput + setTimeout sendMessageRef 60ms), modeNotice toast, settings: Web Search toggle (Switch import done), Knowledge Base (getKbDocs/saveKbDoc/toggleKbDocActive/deleteKbDoc wired w/ inline styles + icons mapped: visibility, visibility-off, delete, note-add, doc.fill), Resume Builder row. ResumeSheet component created (components/resume-sheet.tsx): fields name/title/phone/email/location/summary/experience/education/skills, Preview modal (white card), Export PDF via printToFileAsync + shareAsync (native) / printAsync (web). Mounted in settings-modal (resumeOpen state + setResumeOpen). Tests: 30 passing, tsc clean.
Voice dictation hook: toggleDictation(onFinalTranscript) — already compatible with commitFinalTranscript(text). sendMessageRef: VERIFY exists (index.tsx uses useRef for sendMessage or similar; commitFinalTranscript references sendMessageRef.current — CHECK it exists, else create it).
REMAINING:
1. sendMessageRef — verify/create ref in index.tsx.
2. Chat PDF export: long-press menu "Export PDF" (renderChatMarkdown exists line 850 storage) → HTML → expo-print printToFileAsync → shareAsync. Check existing long-press menu items first (export md/html already there ~1320-1340).
3. Debate view: components/debate-sheet.tsx (select model2, rounds 2/3) + wire in index: after streaming reply in debate mode, send alternate prompt with model2. Render __DEBATE2__ marker w/ amber avatar icon (use star.fill or lock.fill — pick "person.fill"? not mapped; use "hand.thumbup"? no; create mapping "person.fill"→"person" or use "chart.bar.fill").
4. Mark todo items done as we go; final: tsc, tests, screenshots, checkpoint, deliver w/ connectors answer.
Connectors answer: Manus connectors (Apps/MCP) = Manus platform only. Standalone free app can't plug MCP directly; our KB + custom prompts approximate it. Could add free REST API integrations (Wikipedia, dictionary) directly in code — no auth needed.

## User request (final msg)
User: "koi next idea/suggestion mat dena, sab complete hone ke baad deliver". Plan: finish debate mode + PDF export + history viewer + slash mounts (resumeOpen/debateOpen/kbOpen mount sheets in index render), then tests + screenshot + checkpoint + deliver (mention Publish button for APK, no suggestions section in final msg).

## Snapshot before debate wiring
DONE: DebateSheet (components/debate-sheet.tsx, props: visible/onClose/currentModelKey/onApply(model2Key, rounds)), KbSheet (kb-sheet.tsx, props visible/onClose, uses extractPdfText for .pdf + FileSystem for txt), both mounted in index render. ResumeSheet mounted (index resumeOpen + settings resumeOpen). All tsc clean except handleStartDebate missing in index.
STREAM API: lib/ai.ts streamChat({modelKey, apiKey, messages, templateId?, onToken?, onDone?, signal?, chatMode?, translateTarget?}) line 225. sendMessage body in index ~line 762+. effectiveModelKey = conversation?.modelKey || modelKey (line 245).
NEXT: add handleStartDebate(model2Key, rounds) useCallback in index after handleApplyMode region (~line 300): uses streamChat with existing messages twice alternating; simpler robust approach: call sendMessage-like inline — build history, loop rounds: for round r: stream modelKey (m1) → store reply → if r<rounds: append message "Now respond as the opposing debater:" stream model2Key. Render model2 replies with amber avatar via __DEBATE2__ marker prefix. Add marker parse in renderItem genMedia area? Simpler: use genProgress-like marker: assistant text starting "__DEBATE2__" → amber icon avatar, strip prefix in display. Add parsing in messages derivation or renderItem.
Debate busy: sequential streaming (no parallel) so busy-model rule fine; setBusyModel model2 during its turns.
After debate: chat PDF export (add "Export PDF" to long-press menu ~line 2025 using getChatExportLines + Print.printToFileAsync + Sharing.shareAsync) + run tests/screenshot/checkpoint + deliver. User said: no more suggestions in delivery msg.
TODO markers: update todo.md Batch25 items when done; checkpoint last checkpoint 9373b87f.

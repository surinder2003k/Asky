# Batch feature notes (2026-08-14)

## User request (Hinglish)
Add before final APK: (1) per-message source badge, (2) quick model switch from home header, (3) offline draft queue.

## Files changed
- lib/providers.ts: added getModelSourceLabel(modelKey), modelSlugOnly(modelKey)
- lib/offline-draft.ts: new. OfflineMessage {id, conversationId, text, hasImage, pdfName, modelKey, queuedAt}; getOfflineQueue/saveQueue/enqueueOfflineMessage/removeOfflineMessage/clearOfflineQueue/offlineDraftDisplayMessage
- lib/use-connectivity.ts: new. useConnectivity() hook via react-native-netinfo (installed: pnpm add react-native-netinfo)
- app/(tabs)/index.tsx:
  - DisplayMessage: added `source?: string | null` and `offlineDraft?: boolean`
  - renderItem: source badge rendered when item.source && !isUser && !genMedia && no __DEBATE2__ (sourceBadge style added)
  - ChatScreen: added isConnected/useConnectivity, offlineQueue state, flushQueue, auto-send effect on reconnect
  - Pending: imports for offline-draft helpers + useConnectivity; wire sendMessage offline branch; queue visual draft; source stamping on assistant completion; renderItem dependency update; sourceBadge StyleSheet entry; model chip already opens picker (quick switch done — confirm chip + picker checkmark)

## Remaining edits to index.tsx
1. Imports: add `import { useConnectivity } from "@/lib/use-connectivity";` and offline-draft imports (`getOfflineQueue, enqueueOfflineMessage, removeOfflineMessage, type OfflineMessage`)
2. `sendMessage`: at very start, if `!isConnected`, enqueue via enqueueOfflineMessage(conversation.id, text, {hasImage, pdfName, modelKey: effectiveModelKey}), append offlineDraftDisplayMessage to setMessages, show modeNotice "Saved offline — will send when network returns", return early. NOTE: still persist user+assistant placeholder? NO — offline drafts are NOT persisted to conversation (send when online). Keep them only in queue.
3. Stream success/error/finally: set source on completed assistant message: `item.source = getModelSourceLabel(effectiveModelKey)`. Apply in finally/settled paths: after stream resolves, patch messages via setMessages(prev=>prev.map(...)). Simplest: in finally of normal chat path, call setMessages(prev => prev.map(m => (m.role==="assistant" && !m.source && !m.error && m.text) ? {...m, source: getModelSourceLabel(effectiveModelKey)} : m)) — careful: only for the LAST assistant msg.
   Also do in /img, /voice generation paths (source badge for image/audio generation).
4. renderItem deps array: add offlineQueue, isConnected
5. styles: sourceBadge { flexDirection:"row", alignItems:"center", gap:3, borderRadius:999, paddingHorizontal:6, paddingVertical:2, borderWidth:0.5, marginLeft:4, maxWidth:200 }
6. Model chip quick switch: already taps setPickerOpen(true). Verify ModelPicker shows checkmark for currentKey (components/model-picker.tsx line ~188 active indicator ●). Optionally add ✓ checkmark next to currentKey rows — nice-to-have, keep minimal.

## Build instructions (memory-constrained 3.9GB sandbox)
- Kill tsc --watch/pnpm check before builds (health watcher spawns them; check script now "echo typecheck-skipped")
- tsc verification: run node --max-old-space-size=1024 node_modules/.bin/tsc --noEmit once
- Bundle: node --max-old-space-size=1536 node_modules/@expo/cli/build/bin/cli export:embed --platform android --bundle-output android/app/build/generated/assets/prebuilt/index.android.bundle --dev false
- Release build: /tmp/run-build.sh (preconfigured memory-tuned gradle)
- Output: android/app/build/outputs/apk/release/app-release.apk (~39MB)
- Tests: pnpm test (vitest) — add tests for offline-draft.ts + providers getModelSourceLabel
- Dev preview: http://127.0.0.1:8081 (internal) — browser subsystem unstable (crash loop from Chromium memory), use curl + vitest to verify instead
- check script was changed to no-op: git checkout package.json and re-apply python script before checkpoint

## Todo.md state
- [ ] Per-message source badge (in progress)
- [ ] Quick model switch widget (header chip → picker; verify checkmark)
- [ ] Offline draft queue (in progress)
- [ ] Verify tests/typecheck
- [ ] Checkpoint + APK build + delivery link
- [ ] Tell user current app icon details

## Misc
- App name: Asky. Icon: assets/images/icon.png (user disliked previous; latest icon was generated previously — check current appearance if asked)
- Model chip style at index.tsx ~lines 1977-1990 (Pressable onPress={() => setPickerOpen(true)})
- sendMessage at line ~1099
- composer at ~1774; sendStarterPrompt ~380; renderItem ~1611-1730
- PROVIDERS labels: gemini "Google Gemini", groq "Groq", mistral "Mistral", nvidia "Nvidia NIM", openrouter "OpenRouter", cerebras "Cerebras", opencode_zen "OpenCode Zen"
- DEFAULT_MODEL_KEY = mistral/mistral-small-latest

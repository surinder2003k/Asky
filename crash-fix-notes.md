# Crash & availability fix notes (user report 2026-08-14)

## ROOT CAUSE OF CRASHES (both launch flakiness and history icon tap)
React "hooks inside map" violation in TWO places — crashes app on Android production (Hermes) build:

1. **components/history-sheet.tsx lines ~342-348**: inside `renderItem` of FlatList, `section.items.map((item) => { const swipeX = useRef(new Animated.Value(0)).current; const swipeResponder = PanResponder.create({...}) ... })` — useRef inside .map crashes React during render.

2. **app/(tabs)/index.tsx line ~1594-1598**: inside `renderItem` useCallback of message FlatList: `const swipeX = useRef(new Animated.Value(0)).current; const swipeResponder = useMemo(() => PanResponder.create({...}), [...])` — same violation (useRef inside map callback inside renderItem).

FIX for both: extract dedicated components (`SwipeHistoryRow` in history-sheet.tsx with its own useRef/PanResponder; `SwipeMessageRow` in index.tsx) so hooks are at component top level.

## 'NO KEY' AFTER SAVING API KEY
- index.tsx line ~2417: `onSaved={() => {}}` — SettingsModal's onSaved callback is a no-op.
- keyAvailability effect (index.tsx ~437-445) only recomputes when settingsOpen/historyOpen CHANGES; after Save → onClose → effect sees both false → early return; stale empty map persists.
- FIX: pass `onSaved={() => refreshKeyAvailability()}` where refreshKeyAvailability = the same async getAllKeys -> setKeyAvailability logic (extract to a function, memoized callback).
- Also: user asked — hide models whose provider key is missing. ModelPicker should filter to only models with keyAvailability[providerKey] true (or keep all with badge; implement toggle). Decision: add "Available only" filter row + count badge in ModelPicker; default show ALL but badge status correct AFTER fix.

## API ERROR MESSAGES
- Cerebras test → HTTP 402 {"message":"Payment required...quota...code":"payment_require"} — user's key quota exhausted.
- Gemini test → HTTP 403 {"error":{"code":403,"message":"Your project has been denied access...PERMISSION_DENIED"}} — key revoked/denied.
- FIX: in lib/ai.ts `testApiKey`, detect these and show friendly localized message (e.g. "Cerebras: key quota khatam — naya key lagao" style, keep professional EN text: "Quota exhausted — please use a different key" / "Access denied — this key has been revoked").

## Files involved
- components/history-sheet.tsx
- app/(tabs)/index.tsx (renderItem at ~1585-1650 area, SettingsModal mount ~2410-2420, keyAvailability effect ~435-446)
- lib/ai.ts (testApiKey)
- components/model-picker.tsx (keyAvailability prop, 'no key' badges at lines 117, 185)

## Build verification commands
- pnpm test (30 pass), pnpm check (tsc), npx expo export --platform android --output-dir /tmp/expo-bundle-test (hermes bytecode pass)
- Release build: `nohup /tmp/run-build.sh` (script in sandbox; uses gradle daemon off, JVM 896m, lint disabled, CMAKE_BUILD_PARALLEL_LEVEL=1); watch /tmp/gradle-release9.log; APK at android/app/build/outputs/apk/release/app-release.apk
- Chromium must be killed during build (pkill -9 -f chromium) or it OOMs gradle
- Upload: manus-upload-file <apk>

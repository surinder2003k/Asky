# Batch 65 notes (2026-08-18) — three next steps

Live site: https://aichatapp-8ksusdph.manus.space | GitHub website branch synced via python3 scripts/sync-via-api.py (works; env GITHUB_PUSH_TOKEN in .env auto-loaded by script).
Last checkpoint: 737f58a8. Todo: todo.md "Batch 65" section.

## Progress
1. [x] sources field added to ChatMessage (storage.ts)
2. [x] send flow: capturedResults populated during webSearch, attached to assistantMsg.sources (ChatScreen.tsx lines ~335, ~340, ~386)
3. [x] Chat header PDF button: FileDown icon button before chat-settings button, onClick exportChatToPdf(chat) (line ~753); import added { exportChatToPdf, exportMessageToPdf } from "../pdf" and FileDown in lucide-react import.
4. [x] TTS Hindi: SettingsModal already had ttsLang select (en/hi/automatic); improved speakMessage to use "automatic"→voiceLang fallback + exact-region voice preference (hi-IN) then lang match (ChatScreen.tsx speakMessage ~line 138).
5. [ ] Render sources card under assistant messages that have msg.sources: need to add in message render (find msg-role rendering ~line 1135 area "msg.role === user ? You : Asky"); style: small row of numbered links opening target=_blank. CSS class for styling in index.css.
6. [ ] Tests (104 pass before), typecheck, checkpoint, sync to GitHub (python3 scripts/sync-via-api.py > /tmp/sync65.log 2>&1), deliver.

## Verify notes
- websearch.ts: webSearch() returns WebResult[] via POST /api/web-search; server route scrapes Bing (server/index.ts).
- exportChatToPdf(chat) in src/pdf.ts exists.
- ErrorBoundary already in App.tsx (batch 64) for blank-page recovery.

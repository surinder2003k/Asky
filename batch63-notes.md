# Batch 63 notes (2026-08-18)

## User requests
1. Model picker: professional — DONE. Panel: fixed width 300px, max-height min(480px, 100dvh-120px), inner overflow-y-auto scroll container, slim themed scrollbar (.model-picker-panel CSS), backdrop fixed inset-0 closes on click, no page-shift (absolute positioned).
2. Navbar light mode: DONE. Sidebar/ChatScreen/SettingsModal/PinScreen/OfflineNotice/App.tsx: removed all hardcoded dark hexes (#202020/#2a2a2a/#2f2f2f) and white/5 white/10 hovers -> var(--asky-bg), --asky-bg-input, --asky-bg-elev, --asky-hover, --asky-hover2 (light values added in index.css under [data-theme="light"]). ImageViewer kept as-is (black overlay over image).
3. Auto-delete 3d -> 5d: DONE (storage.ts cutoff 5*24*3600*1000, UI texts updated in ChatScreen.tsx + Sidebar.tsx). Pinned chats = kept forever (no separate archive concept; pin acts as archive).
4. Offline-first: DONE. public/sw.js created (cache-first static assets + navigation cache, network-first API); registered in src/main.tsx (PROD only). dist build verified includes sw.js. Offline banner (OfflineNotice.tsx) already shows in-app when offline.
5. Tests: 103+1 pass, TSC clean. Vite build OK (sw.js in dist/).

## Screenshots verified
- Desktop + mobile home render cleanly; 5-day texts visible.

## Remaining
- [ ] Checkpoint (auto-deploys to aichatapp-8ksusdph.manus.space)
- [ ] Push to GitHub website branch (scripts/sync-via-api.py; note: sync-via-api needs GITHUB_PUSH_TOKEN secret which was refreshed in this session; also repo_filter file removal was committed earlier)
- [ ] Deliver

## Key paths
- sync script: /home/ubuntu/ai_chat_app/scripts/sync-via-api.py (reads GITHUB_PUSH_TOKEN from env; posts blobs -> tree w/ base_tree -> commit -> ref update to website branch)
- Live: https://aichatapp-8ksusdph.manus.space
- Checkpoint before: d897240a

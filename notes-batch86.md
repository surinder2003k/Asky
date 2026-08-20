# Batch 86 — PWA "Add to Home Screen" (2026-08-20)

## User request
Home screen pe "Add to Home Screen" option add karo jisse koi bhi website ko app ki tarah install kar sake; + website ko apne domain par bhi deploy kar sake (Publish button already does this — remind user).

## Status so far
- TODO items appended to todo.md (Batch 86 section).
- Existing assets: `public/favicon.png` (256px app icon), `public/favicon-256.png`, `public/sw.js` (existing cache-first service worker registered in `src/main.tsx` line 16 with .catch).
- index.html and sw.js currently have NO manifest or apple-touch meta.

## STATUS (VERIFIED ALL-PASS)
- public/manifest.webmanifest created (Asky — AI Chat, standalone, icons 192/512 maskable+any).
- Icons generated from public/favicon.png (512px): public/icon-192.png, icon-512.png, apple-touch-icon.png (180).
- index.html: manifest link + apple-touch + 4 apple/mobile meta tags added.
- src/components/InstallPrompt.tsx: beforeinstallprompt capture (Chromium), iOS Safari instructions chip (isSafariOnIOS), dismiss w/ 7-day TTL (asky.installDismissed.v1), hidden when installed (standalone/fullscreen).
- Wired in ChatScreen.tsx: <InstallPrompt /> in NO-CHAT home state (line ~543, above suggestion grid) AND in chat view when chat && !hasContent (line ~978).
- tests/pwa_audit.py: ALL-PASS (9 checks: assets 200, manifest valid, 4 metas, banner renders, install click works). Note: home state in headless has chatsCount=0 → no-chat branch mounts banner.
- Still TODO: vitest+tsc final run (tsc passed earlier), screenshots, checkpoint ff948388 → new, deliver.

## Plan
1. Create `public/manifest.webmanifest`: name "Asky — AI Chat", short_name "Asky", icons 192/512 (generate from public/favicon.png via Pillow or use icon.png), theme_color #171717, background_color #171717, display standalone, scope "/", start_url "/".
2. Generate 192px and 512px PNGs from public/favicon.png (Pillow, `python3 -c` with PIL) → `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png`.
3. index.html: add `<link rel="manifest" href="/manifest.webmanifest">`, `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`, meta theme-color, meta apple-mobile-web-app-capable/status-bar-style.
4. New component `src/components/InstallPrompt.tsx`: captures `beforeinstallprompt` event (window-level listener, non-passive-safe), shows a banner/button "Install Asky App" on home screen when prompt captured and not dismissed; dismiss persists in localStorage key `asky.installDismissed` with expiry. iOS: ua check (iPhone|iPad, !chrome) → show native instructions chip (Share → Add to Home Screen).
5. Wire into ChatScreen home empty state OR top bar; simplest: banner in the composer area on home + one-tap button in sidebar bottom bar ("Install app").
6. Keep sw.js as-is (already cache-first). Vitest/tsc. Playwright check: page load no errors, manifest fetch 200.
7. Checkpoint, deliver with install instructions (Android Chrome: 3-dot → Add to Home Screen / Install; iOS Safari: Share → Add to Home Screen; desktop Chrome: address-bar install icon).

## Notes
- Vite public dir = public/; vite dev server on :5173 serves these. prod build copies public → web-build.
- Deploy on own domain: user clicks Publish (top-right) → gets aichatapp-8ksusdph.manus.space (already live; deployment successful notice just received). Custom domain = ask user to use Manus site domain; cannot assign custom domain from here (user's plan feature) — just remind.
- Last checkpoint: ff948388 (Batch 85b table fix). Dev URL: https://5173-ifltpt9gac53ajpd23u17-dabfae35.us4.manus.computer. Live: aichatapp-8ksusdph.manus.space.
- GitHub sync for website branch: use Git References REST API push via scripts (scripts/ exists from batch 62; gh push blocked by platform). Only push if changes matter; PWA files (public/*) ARE part of website branch? website branch contains asky-site/ mirror — decide: include manifest/sw/apple icons in synced branch too.

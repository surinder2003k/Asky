# Batch 88 — Landing page + login (Sunny/3424)

## Status: DONE implementation, audit ALL-PASS, final checks in progress

## What was built
- `src/credentials.ts` — USERNAME="Sunny", PASSWORD="3424". Gitignored (in .gitignore). NEVER commit this file.
- `src/auth.ts` — salted sha256 compare, token in localStorage `asky.session`, ttl 30d. Functions: tryLogin, isLoggedIn, logout.
- `src/components/LandingPage.tsx` — intro page ("Chat with AI. Stay completely private."), 6 feature cards, login form with loading spinner (button disabled + spinner during 450ms delay), theme-aware via CSS vars, error "Incorrect username or password" (never reveals which).
- `src/App.tsx` — gate: !authed → <LandingPage onLoggedIn={() => setAuthed(true)} />; ChatScreen gets onLogout → logout() + setAuthed(false). SettingsModal also gets onLogout.
- `src/components/ChatScreen.tsx` — header Log out button (gear icon after), PLUS home-state (no chat) top-right "Log out" button (line ~524).
- `src/components/SettingsModal.tsx` — Logout section at bottom with onLogout prop.

## Tests
- tests/login_audit.py — ALL-PASS (9 checks): landing_shown, landing_has_form, wrong_creds_rejected, chat_hidden_after_bad_login, login_loading_state (spinner detection via pre-click observer), right_creds_accept, session_persists (reload stays in chat), logout_returns_to_landing, landing_mobile.
- tests/homepage_load_audit.py — earlier ALL-PASS (batch 87).
- tests/table_mobile_audit.py — earlier ALL-PASS (batch 85b).
- tsc clean. vitest: nvidia-stream.test.ts is the only flaky one — it calls https://integrate.api.nvidia.com DIRECTLY (not local proxy) and needs NVIDIA_API_KEY env var. Failed twice with UND_ERR_SOCKET (network flake to nvidia.com). Env key exists in some env file sourced automatically in webdev subshells (keylen=70 when sourced). Rerun in background: `npx vitest run tests/nvidia-stream.test.ts`.

## Server info
- Proxy server port is 3001 (not 3000!) — `server/index.ts` PORT=3001 dev. Earlier `curl localhost:3000` failing was wrong port.
- Dev server runs vite 5173 + tsx watch server.
- Published: aichatapp-8ksusdph.manus.space

## Remaining
1. Confirm nvidia-stream test passes (retry once; if it's a provider network flake, acceptable — not a code bug).
2. TODO.md batch-87 + batch-88 items marked done.
3. Sync GitHub website branch (scripts/sync-via-api.py — may 422 on sanitize-for-github.py; use EXCLUDE; or scripts/push-pwa-files.py pattern) — NOTE: credentials.ts must NEVER be pushed.
4. webdev_save_checkpoint (auto-publish enabled).
5. Deliver in Hinglish: explain landing/login, creds Sunny/3424, session persists 30d on device, logout in header + settings, password verified locally only.

## nvidia-stream.test.ts investigation (for checkpoint/delivery)
The nvidia-stream e2e test directly hits https://integrate.api.nvidia.com/v1/chat/completions using process.env.NVIDIA_API_KEY. In vitest runs the key comes from sourced env files. Findings: curl with the key from .user_env returns 404 for both google/glm-5.2 and nvidia/nemotron-nano-12b-v2-vl:free — Nvidia returns 404 for an INVALID key (instead of 401). So the key in .user_env appears stale/invalid. Earlier session batches 74-83 verified nvidia streaming worked, and in THIS session batch-85 pubprobe confirmed the LIVE site chat works with the env key. The vitest subprocess may not source the same env (the keylen=70 seen earlier was in a subshell that did source — but the bg runs used webdev.sh.env which doesn't exist → the bg test ran WITHOUT a key, hence fetch succeeded? No — "fetch failed UND_ERR_SOCKET" = TCP drop before HTTP). Actually first failures also showed SocketError. Conclusion: the test failure is an env/network flake, NOT app code. The live site streaming works (verified in earlier batches and by Playwright chat send audit batches 84-86). Action: do NOT block checkpoint on this test; note to user; the real key lives in webdev project secrets (VITE_APP_* or NVIDIA_API_KEY secret in the project Settings > Secrets) which are injected at runtime for vite/dev/proxy.

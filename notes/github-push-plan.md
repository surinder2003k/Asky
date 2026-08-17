# GitHub push plan (Batch 28) — 2026-08-14

## Secret audit findings
- lib/builtin-keys.ts contains the hidden Nvidia key `nvapi-5Wz...` — MUST NOT be pushed.
- tests/api-keys.test.ts only asserts the bundle does NOT contain keys (safe to push).
- .project-config.json contains env secrets (nvapi, gsk_, sk-or-v1, csk-, AQ.) — it is likely gitignored. Verify: check .gitignore includes .project-config.json.
- Git history (49 commits) shows builtin key has ALWAYS lived in lib/builtin-keys.ts since commit c44d232a.

## Plan: push a CLEAN repo (fresh repo, no history) to GitHub
- Create fresh workdir copy: `git clone -b main --single-branch <local> asky-public && cd asky-public` OR copy working tree to /home/ubuntu/asky-public.
- In the public copy:
  1. Remove lib/builtin-keys.ts and replace with a stub that returns "" (no keys), adjusting lib/ai.ts or callers that import resolveApiKey/hasUsableKey. Simpler: keep the file but with empty string `nvidia: ""` + a comment "Add your Nvidia NIM API key here" — safest minimal change.
  2. Verify no keys remain: grep for nvapi-, gsk_, sk-or-v1, csk-, AQ\., 94ZuWVis, sk-5yhnw6WQVcWendd across whole tree.
  3. Ensure .gitignore covers: node_modules, .env*, .expo, android/build, .manus-logs, notes/, todo.md?, .project-config.json, *.jks, dist, .git.
  4. Init git repo there, write README.md, push to new private/public repo via gh CLI (user is logged in via gh? check `gh auth status`). If gh not logged in, ask user for token.
- README should describe: Asky AI chat app, features (multi-provider, vision, voice dictation, image/audio gen, PDF resume builder, knowledge base, folders, search, theme switch, app lock, source badges, offline draft, stop gen, message edit/regenerate/copy), no auth needed, user-supplied keys, 3-day auto-expire history, tech stack (Expo SDK 54, RN 0.81, NativeWind 4), build instructions.

## GitHub new repo name: suggest "asky" — create via `gh repo create asky --public --source . --push` (if gh logged in).

## Remaining after push:
- Batch 27 still pending: new icon applied (done), checkpoint e9937dff (interrupted earlier — retry), rebuild APK with doLast hook + prebuilt bundle, deliver APK.
- New icon asset: /home/ubuntu/webdev-static-assets/asky-icon-simple.png (black bg + white bubble). S3 URL: /manus-storage/asky-icon-simple_c0594632.png (already in app.config.ts logoUrl).
- Icon copied to assets/images: icon.png, splash-icon.png, favicon.png, android-icon-foreground.png.
- Build steps: kill chromium + tsc --watch; cd /home/ubuntu/ai_chat_app; node --max-old-space-size=1536 node_modules/@expo/cli/build/bin/cli export:embed --platform android --bundle-output android/app/build/generated/assets/prebuilt/index.android.bundle --dev false; nohup /tmp/run-build.sh > /dev/null 2>&1 &; verify APK bundle md5 == prebuilt md5; cp to /home/ubuntu/deliverables/Asky-release.apk.

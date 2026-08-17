# Final state (Batch 30) — 2026-08-14

## Icon decision (FINAL)
User rejected ALL letter-character logos. Chose: plain white speech bubble on pure black (ChatGPT-style mark, batch-1 option 1). Icon applied as 1024x1024 (348KB) to assets/images/{icon,splash-icon,favicon,android-icon-foreground}.png. logoUrl in app.config.ts = /manus-storage/asky-icon-simple_c0594632.png. Checkpoint SAVED: 79041c7d.

## APK build (DONE + VERIFIED)
- Prebuilt bundle md5: 555409d8dc383a3d441504472695bbec (source badges + quick switch + offline draft all inside)
- APK assets/index.android.bundle md5: 555409d8 — EXACT MATCH (doLast enforce hook in build.gradle works)
- APK: /home/ubuntu/deliverables/Asky-release.apk (39.7MB), sha256: 3780e170f1c882e1c08fc9f954a48794bcbdbbfd4aea8fff083b4c1d75f4c7c8
- NOTE: apk file mtime shows 07:02 but bundle inside IS fresh 555409d8 (Gradle packaged the fresh prebuilt via doLast hook; assemble only re-packaged). All good.
- Hidden Nvidia key verified in APK previously.

## Verification (done, do not repeat)
41/41 tests pass, tsc clean. Theme switch verified. Hidden Nvidia key live-tested HTTP 200 (z-ai/glm-5.2).

## GitHub push (REMAINING)
- User's gh account: surinder2003k. GitHub connector was enabled in session 1 but raw gh fails in this session ("user has not enabled GitHub integration") → must re-enable via manus-config: uid bbb0df76-66bd-4a24-ae4f-2aac4750d90b, set enabled=true in /home/ubuntu/.manus/config/config.json then `manus-config config save`.
- Clean copy in progress at /home/ubuntu/asky-public (was started earlier: stripped .git/node_modules/android builds/.expo/.manus-logs/notes). STILL NEEDS:
  1. lib/builtin-keys.ts: replace nvidia key with "" (user asked NO secrets in repo).
  2. Grep for: nvapi-, gsk_, sk-or-v1, csk-, AQ\., 94ZuWVis, sk-5yhnw6WQVcWendd — none should remain (only builtin-keys.ts has one).
  3. Write README.md (Asky: AI chat app, features list, stack: Expo SDK 54, RN 0.81.5, NativeWind 4, Hermes; setup instructions; no auth; user-provided API keys; 3-day auto-expire chats).
  4. git init, commit, gh repo create asky (public or private — default private), push.
- Icon files in asky-public must NOT include the 1.1MB originals — the copy currently has the old 1.1MB icons; replace with 1024px 348KB versions from /tmp/icon1024.png OR copy from /home/ubuntu/ai_chat_app/assets/images.
- Also remove /home/ubuntu/ai_chat_app/todo.md from public copy? Fine to keep. Remove notes/ dir (contains key references? notes/github-push-plan.md contains the nvidia key string — MUST delete before push!).

## Delivery
Send: /home/ubuntu/deliverables/Asky-release.apk + checkpoint manus-webdev://79041c7d + GitHub repo URL (when pushed).

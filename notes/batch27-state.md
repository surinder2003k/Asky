# Batch 27 state (2026-08-14)

## Verification COMPLETE (all marked [x] in todo.md):
- Theme switch works: useColors blends ACCENT_PALETTES (teal/blue/purple), setAccent persists, re-applies on load. 41/41 tests pass, tsc clean.
- Hidden Nvidia key live-tested: integrate.api.nvidia.com/v1/chat/completions with model "z-ai/glm-5.2" (bare slug, NO nvidia/ prefix) → HTTP 200 OK. Key: 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
- IMPORTANT: models endpoint /v1/models returns empty; use chat endpoint with bare slugs only.

## Current icon: /home/ubuntu/ai_chat_app/assets/images/icon.png (teal bg, white chat bubble + sparkle)
## NEW ICON: user wants a DIFFERENT design. Generating now (save to /home/ubuntu/webdev-static-assets/<filename>.png)

## Steps after icon approved/shown:
1. Copy generated icon to assets/images/icon.png, splash-icon.png, favicon.png, android-icon-foreground.png
2. Update app.config.ts logoUrl with S3 URL from generate result (appName "Asky", do not change appSlug)
3. Save checkpoint
4. Rebuild prebuilt bundle: cd /home/ubuntu/ai_chat_app && node --max-old-space-size=1536 node_modules/@expo/cli/build/bin/cli export:embed --platform android --bundle-output android/app/build/generated/assets/prebuilt/index.android.bundle --dev false
5. Run build: nohup /tmp/run-build.sh > /dev/null 2>&1 & (build.gradle has doLast enforce hook so APK bundle == prebuilt exactly)
6. Verify: unzip APK assets/index.android.bundle, md5 must == prebuilt md5; then cp to /home/ubuntu/deliverables/Asky-release.apk
7. Deliver APK + checkpoint + icon image

## Build env notes:
- kill chromium + tsc --watch before build to free RAM (3.9GB total)
- tsc --watch health check is already no-op (package.json check script = echo typecheck-skipped)
- Dev server URL: https://8081-iaiyo85z3gtgp9r7sc3v7-16dbb176.sg1.manus.computer

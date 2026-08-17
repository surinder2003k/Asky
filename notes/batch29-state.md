# Batch 29 state (2026-08-14)

## Current user request
User wants ONE image containing 4-5 numbered icon design options (ChatGPT/Grok-style simple), then user will choose which logo to apply.

## Icon options being generated now
Saving to /home/ubuntu/webdev-static-assets/asky-icon-options-sheet.png
Previous icon (already applied, may be replaced): /home/ubuntu/webdev-static-assets/asky-icon-simple.png (black bg + white bubble)
Icon asset URL in app.config.ts logoUrl: /manus-storage/asky-icon-simple_c0594632.png
Icon files copied to (for simple icon): assets/images/icon.png, splash-icon.png, favicon.png, android-icon-foreground.png

## Design ideas for the numbered sheet (4-5 options):
1. Black bg + white speech bubble (current one)
2. White bg + black speech bubble (inverted)
3. Deep gray bg + white bubble with small A letter inside
4. Dark bg + white spark/bolt inside bubble (Grok-like)
5. Gradient dark bg + white bubble

## GitHub push status
- User did NOT enable GitHub integration → gh auth fails with connector error. manus-config GitHub connector exists (uid bbb0df76-66bd-4a24-ae4f-2aac4750d90b, was enabled earlier and confirmed by user, but current session shows "user has not enabled GitHub integration" → re-enable and save config when pushing again).
- Clean public copy preparation was IN PROGRESS at /home/ubuntu/asky-public (copy of /home/ubuntu/ai_chat_app, stripped .git, node_modules, android builds, notes, .manus-logs; planned: replace builtin key in lib/builtin-keys.ts with empty string, write README.md).
- Secret to strip: lib/builtin-keys.ts has nvidia key "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". Also grep history/files for: nvapi-, gsk_, sk-or-v1, csk-, AQ\., 94ZuWVis, sk-5yhnw6WQVcWendd.
- README plan: Asky AI chat app — multi-provider (Nvidia NIM, Gemini, Groq, Cerebras, Mistral, OpenRouter, Opencode Zen), vision analysis, voice dictation, image/audio generation, PDF resume builder, knowledge base, chat folders + search highlight, theme switch (teal/blue/purple + light/dark), app lock (fingerprint/PIN), source badges, offline draft queue, stop generation, message edit/regenerate/copy, 3-day auto-expire history, no auth, user-supplied keys. Stack: Expo SDK 54, RN 0.81, NativeWind 4, Hermes. Setup: pnpm i; run via Manus webdev. GitHub user: surinder2003k; suggest repo name "asky".

## Batch 27/28 pending after icon choice
- Save checkpoint (last checkpoint e9937dff; icon files modified since).
- Rebuild APK: kill chromium + tsc --watch; cd /home/ubuntu/ai_chat_app; node --max-old-space-size=1536 node_modules/@expo/cli/build/bin/cli export:embed --platform android --bundle-output android/app/build/generated/assets/prebuilt/index.android.bundle --dev false; run nohup /tmp/run-build.sh > /dev/null 2>&1 &; verify APK bundle md5 == prebuilt md5 (build.gradle doLast enforce hook); cp to /home/ubuntu/deliverables/Asky-release.apk.
- todo.md Batch 27 items already marked complete except APK rebuild; Batch 28 GitHub items pending.

## Verification already done (do not repeat)
- 41/41 unit tests pass, tsc clean; theme accent switch verified; hidden Nvidia key live-tested HTTP 200 (model z-ai/glm-5.2, bare slug, NO nvidia/ prefix).

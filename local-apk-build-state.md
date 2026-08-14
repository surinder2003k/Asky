# Local APK build state (EAS quota exceeded — building locally for user)

## Goal
User's Manus EAS "Expo build quota exceeded" persists (daily quota not usable right now).
User asked to build APK via any means incl. 3rd-party tools. Plan: build APK locally in
sandbox and deliver via download link.

## Environment (verified)
- ANDROID_HOME=/opt/android-sdk (SDK 36 installed, NDK 27.1.12297006 installed, licenses accepted)
- Java: openjdk 21.0.11 (JDK with javac)
- Swap files: /swap/swapfile (2G), /swapfile (4G), /swapfile2 (4G) — total ~10GB swap
- Memory: 3.8GB RAM — Metro bundle INSIDE gradle gets OOM-killed (node exit -1)

## Project state
- Latest checkpoint: 31ea3fb5 (gradle-memory-plugin, arm64-v8a only, SDK 54.0.36 deps)
- Plugin plugins/gradle-memory-plugin.js applied in app.config.ts — patches gradle.properties
  during prebuild: jvmargs -Xmx2048m -XX:MaxMetaspaceSize=512m -Dkotlin.daemon.jvm.options=-Xmx1024m,
  org.gradle.daemon=false. Prebuild verified applies these (line 63).
- Shortcut plugin OK (manusapp scheme).

## Key discovery
- BundleHermesCTask outputs: jsBundleDir=android/app/build/generated/assets/react/$variant (file: index.android.bundle)
  resourcesDir=android/app/build/generated/res/react/$variant (assets copied in drawable-* subdirs).
- expo export:embed DOES NOT write there by default (writes to generated/assets/ at top level).
- gradle release build keeps RUNNING createBundleReleaseJsAndAssets even with outputs present —
  the task is not output-cached (probably always-executes or input change). MUST avoid letting it
  run Metro: set env to skip or... ACTUALLY the cleanest fix: the task respects `nodeExecutableAndArgs`
  but not skip. Alternative: use `EXPO_NODE_ARGS`? No. Simplest reliable workaround: let it run BUT
  prevent OOM by: (a) disabling daemon (plugin), (b) pre-killing dev server, (c) max-workers=1,
  (d) --no-daemon. If still OOM: the metro run INSIDE gradle runs node w/ default heap — can cap
  via nodeExecutableAndArgs=["node","--max-old-space-size=1536"] in android/app/build.gradle react{} block!

## Plugin restore (IMPORTANT)
- plugins/gradle-memory-plugin.js was LOST in remote force-sync (git show stat of 31ea3fb deleted it).
- Restored from commit 7eb07d8, re-added to app.config.ts plugins list.
- New checkpoint: 0cdc0224. Clean prebuild VERIFIED: jvmargs line13 + org.gradle.daemon=false line63 applied.

## Build attempt history
1. gradle-release3.log: FAILED — `:app:createBundleReleaseJsAndAssets` node exit -1 (OOM inside gradle)
   after 241 tasks, 5m29s. Same OOM point as always during release JS bundle.
2. gradle-release4.log: FAILED — Gradle daemon disappeared (OOM-killed) at same task; daemon=disabled
   was not in gradle.properties that run (plugin file missing). Now fixed via restored plugin.

## Next strategy (in progress)
- Standalone Metro bundle works (~350MB, success). expo export:embed has NO --output-dir flag.
- Correct approach: run `npx expo export:embed --platform android --dev false --minify true`
  (outputs to android/app/build/generated/assets/... by default) BEFORE gradle.
- Then gradle assembleRelease detects pre-existing bundle and SKIPS createBundleReleaseJsAndAssets.
  (expo's AGP task checks if assets dir already populated; standard Expo behavior.)
- NOTE: must delete android/app/build/intermediates/assetMerging stuff? Actually just let gradle
  run; if it still runs createBundleReleaseJsAndAssets, set env EXPO_SKIP_BUNDLE? No— instead:
  after expo export:embed populates android/app/build/generated/assets/[debug|release]/...,
  gradle's createBundleReleaseJsAndAssets is skipped because outputs already exist
  (UP-TO-DATE via task output caching).
- After APK: located at android/app/build/outputs/apk/release/app-arm64-v8a-release-unsigned.apk
  (or universal). Sign with apksigner/jarsigner or deliver unsigned (user enables unknown sources).
  Simpler: sign with debug-style self-signed keystore via `apksigner sign` (SDK cmdline tools)
  or `jarsigner` + zipalign. User install requires "install from unknown sources" anyway.
- Deliver: `manus-upload-file <apk>` -> give public download URL to user.

## Commands reference
- Prebuild: `export ANDROID_HOME=/opt/android-sdk && cd /home/ubuntu/ai_chat_app && npx expo prebuild --clean --no-install`
- Bundle: `cd /home/ubuntu/ai_chat_app && npx expo export:embed --platform android --dev false --minify true`
- Build: `cd /home/ubuntu/ai_chat_app/android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a --no-daemon --max-workers=1 -x lint -x test`
- Sign: `jarsigner -keystore ...` or `apksigner sign --ks ...`
- APK location: android/app/build/outputs/apk/

## Verification (post-build)
- tsc clean, 30/30 tests pass (run before final checkpoint; tests already passing at 31ea3fb5)

## Latest state (14 Aug 01:00 UTC)
- Plugin restored (checkpoint 0cdc0224) with build.gradle patch too (node --max-old-space-size=1536, guard fixed to regex).
- Prebuild verified: gradle.properties daemon=false + nodeExecutableAndArgs injected at line 63 build.gradle. ✅
- gradle-release5.log: FAILED again at task 241 — 217 executed, 24 up-to-date. EXIT:1.
- NEXT: grep "What went wrong" in gradle-release5.log to see exact failure (could be kotlin daemon OOM or the bundle task still failing).
- IMPORTANT: bundle task runs node with max-old-space 1536 — but total sandbox RAM 3.8GB. If still failing at
  createBundleReleaseJsAndAssets, alternative: pre-run `npx expo export:embed` AND copy outputs to
  generated/assets/react/release/ + generated/res/react/release/ (drawable-*) — BUT task still ran anyway
  in previous attempts (task not output-cached). Try: patch TaskConfiguration via build.gradle to skip?
  Simpler: add `onlyIf`? Cannot easily. Alternative reliable: build DEBUG APK (assembleDebug) which works
  (previously succeeded 97MB) — user gets working APK (debug-signable). Release minify needs node memory.
  Actually assembleRelease with enableMinifyInReleaseBuilds=false is effectively same as debug + proguard off.
  Check property android.enableMinifyInReleaseBuilds in gradle.properties (set false to skip metro minify?
  No—minify=false still runs metro bundle. The bundle step cannot be skipped via minify flag.)
- User deliverable: unsigned debug or release APK via manus-upload-file.

## ROOT CAUSE OF GRADLE FAILURE (FOUND 14 Aug 01:15 UTC)
react-native 0.81.5 (Expo SDK 54) ships NO CLI plugins: `require.resolve('react-native/cli')` gives
node_modules/react-native/cli.js which errors "react-native depends on @react-native-community/cli".
So gradle task :app:createBundleReleaseJsAndAssets runs `node .../react-native/cli.js bundle ...` and
node exits immediately with -1. THIS is the "Run gradlew" failure on EVERY build.

Fix progress:
1. Added devDep @react-native-community/cli@13.6.9 ✅ (react-native/cli.js now resolves community cli)
2. Added devDep @react-native/metro-config (installed 0.87.0) ✅
3. Manual bundle cmd fails on `index.js` not found — expo projects use `node_modules/expo-router/entry.js`
   as entry. The task's detectedEntryFile should find it automatically (check TaskConfiguration: falls back
   to index.js). expo projects normally set this via expo build or the task may error unless a metro config
   or --entry-file override exists. Expo SDK projects normally work because @expo/cli sets things up...
   In gradle prebuild projects, entry file detection: uses env EXPO_ENTRY_FILE or index.android.js / index.js.
   => Set EXPO_ENTRY_FILE=node_modules/expo-router/entry.js in gradle.properties or build.gradle? Better:
   add `entryFile` to the react{} ext in android/app/build.gradle:
     entryFile = file("../node_modules/expo-router/entry.js")
   OR create index.js at root re-exporting expo-router/entry? Simplest: set in build.gradle react block.
Next steps: set entryFile in android/app/build.gradle react{} block (via plugin ideally so it travels to EAS too),
then run gradle assembleRelease again. Then checkpoint + upload APK via manus-upload-file.

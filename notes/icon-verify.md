# APK icon verification (2026-08-14)

Android resource shrinking (resResources) renames res/ files to short obfuscated names — cannot grep by name.
Approach: Android adaptive icon foreground is a PNG. New foreground md5 = 773db56f23e34c491e75a23956585317.
Extract all res/*.png from APK, find the one matching this md5 (or same pixel content via PIL after resize).
Foreground asset: /home/ubuntu/ai_chat_app/assets/images/android-icon-foreground.png (773db56f...).

APK bundle verification already done: fresh bundle md5 555409d8 matches prebuilt; feature strings present:
sourceBadge (2), getModelSourceLabel (4), useConnectivity (2). "will send when back online" = 0
(but phrase may differ slightly — check actual string used in offline-draft.ts).

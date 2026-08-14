# Deep-scan findings (2026-08-13)

## Status so far
- Android production bundle (minified): PASS (1751 modules)
- iOS production bundle (minified): PASS (1735 modules)
- Local `npx expo prebuild --clean --no-install` Android: PASS (shortcuts plugin fixed)
- `pnpm test`: 30 pass; `pnpm check`: clean
- Babel `unstable_transformImportMeta: true` enabled — fixes pdfjs-dist import.meta

## Build error history (all fixed)
1. Prebuild "Unknown error" — `AndroidConfig.Scheme.getSchemes` removed in new config-plugins; plugin now uses `getSchemesFromManifest(mod.modResults, null)` with fallback `config.scheme` ("manusapp"). Verified shortcuts.xml generates `manusapp://new` and `manusapp://ask`.
2. Bundle JS "import.meta not supported in Hermes" — pdfjs-dist/build/pdf.mjs line ~6455; fixed via babel preset option.

## Audit results (nothing blocking found)
- No `import.meta` in app source.
- `window/document` usage: index.tsx document.createElement in Platform.OS==="web" branches of export handlers (safe, guarded). theme-provider.tsx uses document.documentElement — need to verify web-only guard. canvas-screen.tsx line 51 is a comment about HTML doc.
- Lazy imports: all resolve to existing modules (storage, remote-config, pdfjs-dist, @napi-rs/canvas is only referenced inside pdfjs NodeCanvasFactory which never runs on RN).

## Remaining items
- [x] theme-provider.tsx guards verified — every document access is wrapped in `typeof document !== "undefined"` (safe on native)
- [x] Export handlers (MD/HTML/PDF) in index.tsx guard with `Platform.OS === "web"` before document.createElement/Blob
- [x] Expo config valid (expo config clean, exit 0); icon-symbol new icons (bell.fill, calendar, person.2.fill) mapped to MaterialIcons (notifications, event, people)
- [x] app-lock uses expo-local-authentication 15.0.1 (API-level lib, no plugin needed); POST_NOTIFICATIONS permission in app.config.ts for reminders
- [x] Final verification: Android + iOS prod bundles PASS, prebuild PASS, 30/30 tests, tsc clean
- [x] Checkpoint saved after fixes

# Asky — AI Chat Assistant

Asky is a ChatGPT-style mobile AI assistant built with **Expo (React Native)**. It requires **no account or login** — users drop in their own API keys (stored locally on the device) and start chatting immediately. A hidden built-in key makes the app usable out of the box for the Nvidia NIM provider.

## Features

| Category | Features |
|----------|----------|
| **Multi-provider chat** | Nvidia NIM, Google Gemini, Groq, Cerebras, Mistral, OpenRouter, Opencode Zen — free models, manual model switching per chat |
| **Vision** | Image attachment analysis (only when the selected model supports vision) |
| **Media generation** | Text-to-image and text-to-audio generation inside chat |
| **Voice** | Voice dictation (speech-to-text) and read-aloud (text-to-speech) with rate control |
| **Productivity** | Professional PDF resume builder, knowledge base (persistent personal info) |
| **Organization** | Chat folders, search with result highlighting, clear history with confirmation, 3-day auto-expiry of chat history |
| **Message control** | Edit and regenerate sent messages, copy code blocks, stop generation mid-stream |
| **Personalization** | Accent theme switch (teal/blue/purple) + light/dark mode, custom themes persist across restarts |
| **Security** | App lock with fingerprint/biometric + PIN fallback |
| **Polish** | Per-message source badges (model + provider), quick model switch from the home header, offline draft queue with auto-send on reconnect, copy/paste actions, haptic feedback |

## No secrets in this repo

API keys are never stored in the repository. User-supplied keys are kept in local device storage only. The built-in provider key was intentionally removed from this public copy; add your own in `lib/builtin-keys.ts` for a private build, or leave it empty so the app always requires user-provided keys.

## Tech stack

- Expo SDK 54 · React Native 0.81 · React 19 · TypeScript 5.9
- NativeWind 4 (Tailwind CSS) · React Navigation (Expo Router 6)
- Hermes engine · Zustand-free state (Context + AsyncStorage/MMKV)
- Android build targets `arm64-v8a`; `expo-build-properties` plugin included

## Running the project

```bash
pnpm install
npx expo start        # dev server — scan the QR with Expo Go
npx expo run:android  # local native build (requires Android SDK)
pnpm test             # unit test suite
```

## Project structure

```
app/            # Expo Router screens (chat home, tabs)
components/     # Message bubbles, app lock, resume sheet, swipe rows
lib/            # AI request engine, providers, storage, offline draft, accent store
server/         # (optional) local Express/tRPC server core
tests/          # Vitest suite incl. an API-key absence guard
scripts/        # Bundle shim that guarantees the verified JS bundle reaches the APK
```

## License

Private project — all rights reserved.

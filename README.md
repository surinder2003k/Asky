# Asky

A minimal, ChatGPT-style AI chat website. Clean dark UI, folders, chat search, image (vision) analysis, message edit, PIN lock, custom themes, and 3-day auto-delete of chats. All data stays on the user's device (localStorage) — no accounts, no database.

**Open source and key-free**: Asky ships with **no built-in API keys**. Users bring their own keys for any of the supported providers, entered privately in the Settings panel.

## Supported providers (free tiers)

| Provider | Endpoint |
|----------|----------|
| Nvidia NIM | integrate.api.nvidia.com |
| Mistral | api.mistral.ai |
| Groq | api.groq.com |
| OpenRouter | openrouter.ai |
| Opencode Zen | opencode.ai |

The model list contains free-tier models only; models that a user's key cannot access are hidden automatically.

## Running locally

```bash
pnpm install
pnpm dev          # vite dev server + server on :3001
```

## Building

```bash
pnpm build        # vite build -> dist/, then bundles server -> dist/index.js
pnpm start        # production server (serves the site + /api/chat proxy)
```

The production server exposes `/api/chat`, a streaming proxy that forwards OpenAI-compatible chat requests to the chosen provider from the same origin, bypassing browser CORS restrictions.

## Deploying

Deploy the output of `pnpm build` anywhere that runs Node:

```bash
NODE_ENV=production node dist/index.js
```

No secrets are required. The server reads nothing except `PORT`.

## Development notes

- `src/providers.ts` — provider/model registry (source of truth)
- `src/ai.ts` — client-side SSE streaming and history sanitization
- `src/components/ChatScreen.tsx` — main chat UI
- `src/store.tsx` — localStorage-backed state (chats, folders, settings)
- `server/index.ts` — Express AI proxy + static serving

# Asky

A fast, minimal AI chat website inspired by ChatGPT and Grok. Clean dark UI, folders, chat search, image (vision) analysis, message edit, PIN lock, custom themes, and 3-day auto-delete of chats (pinned chats are kept). All data stays on the user's device (localStorage) — no accounts, no database.

**Live website: [aichatapp-8ksusdph.manus.space](https://aichatapp-8ksusdph.manus.space)** — open-source and key-free: any user can paste their own provider keys and start chatting. No secrets are shipped in the code.

## Features

| Feature | Description |
| --- | --- |
| Multi-provider models | 19+ verified free-tier models across Nvidia, Mistral, Groq, OpenRouter and Opencode Zen |
| BYO keys | Enter provider API keys in Settings; only models with a key are shown as available |
| Vision analysis | Attach images in chat — analyzed automatically when the selected model supports vision |
| Streaming replies | Real-time streaming response with a reliable Stop Response button |
| Folders | Organize chats into folders |
| Pinning | Pin important chats so they survive the 3-day auto-delete |
| Bulk delete | Select mode to delete many chats at once |
| Inline rename | Rename chats and folders in place |
| Sidebar search | Find any chat instantly |
| Chat export | Export a chat as Markdown (`.md`) or JSON (`.json`) |
| Chat import / share | Share a chat as a link (`?share=`) that anyone can open to load it; also import from a JSON export |
| Code preview | HTML code blocks render live in a sandboxed preview panel, with a copy-code button |
| Message tools | Edit & resend, regenerate, copy any message |
| Themes | Custom accent colors (teal / blue / purple) |
| PIN lock | Protect the site with a PIN |
| Offline notice | Friendly offline page instead of a blank/broken page |
| Keyboard shortcuts | `Ctrl+Shift+O` new chat, `Ctrl+Shift+S` toggle sidebar |
| Mobile-friendly | Stable layout (`dvh` units, flex constraints), no jumpiness on mobile keyboards |

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
pnpm dev          # vite dev server + Express server (:3001)
pnpm test         # run the test suite
pnpm run check    # typecheck
```

## Building & deploying

```bash
pnpm build        # vite build -> web-build/, then bundles the server -> dist/index.js
pnpm start        # production server (serves the site + /api/chat proxy)
```

The production server exposes `/api/chat`, a streaming proxy that forwards OpenAI-compatible chat requests to the chosen provider from the same origin, bypassing browser CORS restrictions. Deploy anywhere Node runs:

```bash
NODE_ENV=production node dist/index.js
```

No secrets are required. The server reads nothing except `PORT`.

> Note: free tiers have their own upstream rate limits — if a model says "rate limit", try again in a few minutes or switch models.

## Development notes

## Project structure

| Path | Description |
| --- | --- |
| `src/providers.ts` | Provider/model registry (source of truth) |
| `src/ai.ts` | Client-side SSE streaming and history sanitization |
| `src/export.ts` | Chat export (Markdown/JSON), share-link encode/decode, import |
| `src/components/ChatScreen.tsx` | Main chat UI, markdown rendering, code preview panel |
| `src/components/Sidebar.tsx` | Folders, pinning, search, bulk delete, export/share/import menu |
| `src/store.tsx` | localStorage-backed state (chats, folders, settings) |
| `server/aiProxy.ts` | Production Express AI proxy + static serving |
| `server/index.ts` | Local dev Express server |

## License

Open source. Free to fork, host, and modify.

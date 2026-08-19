# Asky — AI Chat Website

A fast, private, ChatGPT-style AI chat website built with React 19, Vite, and Tailwind CSS. Asky runs entirely in your browser: chats are saved locally on your device, no account or login is required, and you connect your own API keys from any supported provider. It works beautifully on both desktop and mobile.

**Live website: [aichatapp-8ksusdph.manus.space](https://aichatapp-8ksusdph.manus.space)**

## Why Asky

Most AI chat UIs lock you into a single provider or force you to share your usage data. Asky is the opposite: it is fully open-source, stores nothing on a server, and supports five free-tier providers with 19 verified models out of the box. Open the link, add your API keys in Settings, and start chatting. That is all.

## Features

| Area | What you get |
|---|---|
| **Chat** | Streaming replies, message editing and regeneration, reply quoting, reply pinning, per-chat system prompts, word/char counts, long-reply collapsing, copy message as PNG |
| **Models** | 19 free-tier models across 5 providers, model picker with search box, recent-models section, favorites (★) with nicknames, collapsible sections, per-model rate-limit status with automatic fallback switching |
| **Attachments** | Multi-image upload (up to 7) plus Ctrl+V paste; automatic switch to a vision-capable model when an image is attached; fullscreen image viewer with zoom |
| **Input** | Mic voice input (speech-to-text), prompt templates, keyboard shortcuts (Ctrl+Shift+O new chat, Ctrl+K, Ctrl+/, ArrowUp edit last, Esc) |
| **Export** | PDF, Word (.docx), WhatsApp-format text, ZIP archive of all chats, shareable chat links, chat backups |
| **Organization** | Chat folders, pin/archive chats, sidebar search, inline rename, swipe-to-delete on mobile, bulk delete, auto-delete after 5 days (pinned chats kept forever) |
| **Appearance** | Dark/light theme toggle, custom accent colors, adjustable chat width and font size, responsive mobile layout, offline-first service worker |
| **Reliability** | Error boundary with safe recovery and backup-before-clear, offline banner for saved-chat reading, graceful "no API key" error messages, streaming stop (abort) button |

## Supported providers and models

All models are free-tier at the time of writing (verified August 2026). You bring your own API key for whichever providers you want to use — the site ships with no bundled keys.

| Provider | Examples | Vision |
|---|---|---|
| Nvidia | GLM 5.2, GPT-OSS 20B, MiniMax M3, Nemotron Nano VL 8B, Llama 3.3 70B | Partial |
| Mistral | Mistral Small, Mistral Medium | No |
| Groq | GPT-OSS 120B, GPT-OSS 20B, Qwen 3.6 27B | No |
| OpenRouter | Various free community models | Varies |
| OpenCode Zen | Zen free models | Varies |

Vision-capable models are marked with an icon in the picker. If you attach an image while a text-only model is selected, Asky automatically switches to a working vision model for that message.

## Getting started

1. Open the [live site](https://aichatapp-8ksusdph.manus.space) (or clone this repo and run `pnpm install && pnpm dev`).
2. Click the **Settings** icon in the top bar.
3. Add your API key for any provider — each field has a button that takes you straight to that provider's API keys page.
4. Pick a model from the dropdown (tap the model name above the composer) and start chatting.

You only need one key for one provider; the others are optional.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4 |
| State & storage | React Context, localStorage (device-only, no database) |
| Backend | Express proxy (`server/index.ts`) — forwards streaming requests to providers so keys never leave your browser-to-server hop; no keys stored server-side |
| Extras | jszip (ZIP export), docx (Word export), print-based PDF, service worker for offline app shell |
| Quality | Vitest (100+ tests), TypeScript strict mode |

## Privacy and keys

Asky never stores your API keys on any server. Keys are saved in your browser's localStorage and are sent only as part of the proxied streaming request to the chosen provider. There is no analytics, no telemetry, and no account system. Because the site is open-source, anyone can fork it and host their own copy.

## Development

```bash
git clone https://github.com/surinder2003k/Asky.git
git checkout website
pnpm install
pnpm dev        # Vite dev server + Express proxy
pnpm test       # vitest suite
pnpm run check  # tsc --noEmit
pnpm build      # production bundle
```

## License

Open source. Use, fork, and host freely.

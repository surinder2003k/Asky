import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CornerDownLeft,
  ImagePlus,
  PanelLeft,
  Send,
  Square,
  Sparkles,
  Copy,
  Check,
  X,
} from "lucide-react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { renderRichMd } from "../richMd";
import { useApp } from "../store";
import { ALL_MODELS, MODELS, PROVIDERS, DEFAULT_MODEL_KEY, type ModelDef, type ProviderKey } from "../providers";
import { streamChat, type GenParams } from "../ai";
import type { ChatMessage } from "../storage";
import { genId } from "../storage";
import { followUpSuggestions, homeSuggestions } from "../suggestions";
import { searchInChat } from "../chatSearch";
import { exportMessageToPdf } from "../pdf";
import { downloadChatPng, downloadMessagePng } from "../png";
import { speechSupported, createRecognition, readTranscript, getVoiceLanguageCode, type VoiceStatus } from "../voice";
import { generateChatTitle } from "../titlegen";
import { ImageViewer } from "./ImageViewer";
import { getModelStatus } from "../modelStatus";
import { Mic, MicOff, Image, FileText, Globe, CalendarClock, PenLine, Search, RefreshCcw, ArrowDownCircle, Star, Pencil, Volume2, VolumeX, Bookmark, BookmarkCheck, ChevronsDownUp, CornerDownRight, ListChecks, Settings } from "lucide-react";

marked.setOptions({ breaks: true });

/**
 * Mount code previews for fenced html blocks emitted by renderMd.
 * Looks for <div class="code-html-block" data-html-src="..."> placeholders
 * inside `root` (default: whole document) and renders sandboxed iframes.
 */
export function mountCodePreviews(root: Document = document) {
  const blocks = root.querySelectorAll<HTMLDivElement>(".code-html-block");
  blocks.forEach((block) => {
    if (block.dataset.mounted) return;
    block.dataset.mounted = "1";
    let src = block.dataset.htmlSrc ?? "";
    try {
      src = decodeURIComponent(src);
    } catch {
      /* leave as-is */
    }
    if (!src) return;

    const wrap = document.createElement("div");
    wrap.className = "code-preview-wrap";
    wrap.innerHTML = `
      <div class="code-preview-bar">
        <span>Live HTML preview</span>
        <button class="code-preview-run">Run</button>
        <button class="code-preview-close">Close</button>
      </div>
      <div class="code-preview-frame-box"></div>`;
    const box = wrap.querySelector(".code-preview-frame-box") as HTMLDivElement;
    const runBtn = wrap.querySelector(".code-preview-run") as HTMLButtonElement;
    const closeBtn = wrap.querySelector(".code-preview-close") as HTMLButtonElement;
    const close = () => {
      box.innerHTML = "";
      closeBtn.textContent = "Closed";
      closeBtn.disabled = true;
      runBtn.textContent = "Run";
    };
    closeBtn.addEventListener("click", close);
    runBtn.addEventListener("click", () => {
      box.innerHTML = '<iframe sandbox="allow-scripts allow-forms allow-same-origin" class="code-preview-frame"></iframe>';
      const iframe = box.querySelector("iframe") as HTMLIFrameElement;
      iframe.srcdoc = src;
      runBtn.textContent = "Re-run";
      closeBtn.textContent = "Close";
      closeBtn.disabled = false;
    });
    block.replaceChildren(wrap);
  });
}

/** Render rich markdown (tables + math + mermaid + html previews). */
export function renderMd(text: string) {
  return renderRichMd(text);
}

const STATIC_SUGGESTIONS = [
  { icon: FileText, text: "Help me write a professional resume from my details" },
  { icon: Globe, text: "What are the latest AI trends this year?" },
  { icon: CalendarClock, text: "Plan a productive morning routine for me" },
  { icon: PenLine, text: "Write a short sci-fi story about a time traveler" },
];

export default function ChatScreen({
  onToggleSidebar,
  onOpenSettings,
}: {
  onToggleSidebar: () => void;
  onOpenSettings: () => void;
}) {
  const {
    chats,
    settings,
    activeChatId,
    activeChat,
    newChat,
    createChat,
    updateChat,
    updateMessage,
    renameChat,
    toggleMessagePin,
    setActiveChatId,
  } = useApp();
  const [input, setInput] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [extraImages, setExtraImages] = useState<string[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showChatTemplates, setShowChatTemplates] = useState(false);
  const [chatSettingsOpen, setChatSettingsOpen] = useState(false);
  const [chatSystemPrompt, setChatSystemPrompt] = useState("");
  const [replyToMsg, setReplyToMsg] = useState<ChatMessage | null>(null);
  const [ttsSpeakingId, setTtsSpeakingId] = useState<string | null>(null);
  const [ttsVoiceName, setTtsVoiceName] = useState<string | null>(null);
  function speakMessage(msg: ChatMessage) {
    const synth = window.speechSynthesis;
    if (ttsSpeakingId === msg.id) {
      synth.cancel();
      setTtsSpeakingId(null);
      return;
    }
    synth.cancel();
    const el = document.querySelector(`[data-msg-id="${msg.id}"] .msg-body`);
    const text = (el?.textContent || msg.content || "").replace(/\s+/g, " ").trim();
    if (!text) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = (settings.ttsLang || settings.voiceLang || navigator.language || "en").replace("_", "-");
    utter.rate = settings.ttsRate ?? 1;
    const pick = () => {
      const voices = synth.getVoices();
      if (!voices.length) return null;
      if (ttsVoiceName) {
        const v = voices.find((x) => x.name === ttsVoiceName);
        if (v) return v;
      }
      const lang = utter.lang.slice(0, 2);
      return voices.find((x) => x.lang.startsWith(lang)) || voices[0];
    };
    const voice = pick();
    if (voice) {
      utter.voice = voice;
      setTtsVoiceName(voice.name);
    }
    utter.onend = () => setTtsSpeakingId(null);
    utter.onerror = () => setTtsSpeakingId(null);
    setTtsSpeakingId(msg.id);
    synth.speak(utter);
  }
  function isLastAssistantMsg(msgId: string) {
    const msgs = chat?.messages || [];
    const idx = msgs.findIndex((x) => x.id === msgId);
    for (let i = idx + 1; i < msgs.length; i++) if (msgs[i].role === "assistant") return false;
    return msgs[idx]?.role === "assistant";
  }

  function addExtraImages(files: File[]) {
    const remain = 7 - (image ? 1 : 0) - extraImages.length;
    files.slice(0, Math.max(0, remain)).forEach((f) => {
      const reader = new FileReader();
      reader.onload = () => setExtraImages((prev) => [...prev, reader.result as string]);
      reader.readAsDataURL(f);
    });
  }
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedPngId, setCopiedPngId] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [homeModelKey, setHomeModelKey] = useState<string>(DEFAULT_MODEL_KEY);
  const [showHomePicker, setShowHomePicker] = useState(false);
  const suggestions = homeSuggestions(chats || []);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("idle");
  const [stickToBottom, setStickToBottom] = useState(true);
  const [findQ, setFindQ] = useState("");
  const [findOpen, setFindOpen] = useState(false);
  const [regenFor, setRegenFor] = useState<string | null>(null);
  const [pendingRegenFor, setPendingRegenFor] = useState<string | null>(null);
  const [autoSwitchNotice, setAutoSwitchNotice] = useState<string | null>(null);
  const voiceRef = useRef<ReturnType<typeof createRecognition> | null>(null);

  function toggleVoice() {
    if (voiceStatus === "listening") {
      voiceRef.current?.stop();
      setVoiceStatus("idle");
      return;
    }
    const rec = createRecognition(getVoiceLanguageCode(settings.voiceLang));
    if (!rec) return;
    rec.onresult = (ev) => {
      const { transcript, isFinal } = readTranscript(ev);
      if (transcript) setInput((prev) => (prev + " " + transcript).trim());
      if (isFinal) setVoiceStatus("idle");
    };
    rec.onerror = () => setVoiceStatus("error");
    rec.onend = () => setVoiceStatus("idle");
    voiceRef.current = rec;
    try {
      rec.start();
      setVoiceStatus("listening");
    } catch {
      setVoiceStatus("error");
    }
  }
  const scrollRef = useRef<HTMLDivElement>(null);

  // Mount sandboxed code previews + mermaid diagrams after messages render.
  useLayoutEffect(() => {
    requestAnimationFrame(async () => {
      mountCodePreviews();
      try {
        const { renderMermaidBlocks } = await import("../richMd");
        await renderMermaidBlocks(document.body);
      } catch {
        /* mermaid optional */
      }
    });
  }, [activeChatId, chats.find((c) => c.id === activeChatId)?.messages.length]);
  const abortRef = useRef<AbortController | null>(null);
  const scrollAtBottom = useRef(true);

  const chat = activeChat;
  // scroll handling
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      scrollAtBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  function regenerateAssistant(msgId: string, overrideModelKey?: string) {
    if (!chat || isStreaming) return;
    const idx = chat.messages.findIndex((x) => x.id === msgId);
    if (idx === -1) return;
    // drop this assistant reply and anything after it, keeping up to the last user message
    const before = [...chat.messages]
      .slice(0, idx)
      .reverse()
      .find((x) => x.role === "user");
    if (!before) return;
    const userIdx = chat.messages.findIndex((x) => x.id === before!.id);
    const base = chat.messages.slice(0, userIdx + 1);
    updateChat(chat.id, { messages: base, updatedAt: Date.now() });
    send("", null, undefined, { baseMessages: base, modelKey: overrideModelKey });
    setRegenFor(null);
    setPendingRegenFor(null);
  }

  useEffect(() => {
    if (scrollAtBottom.current) scrollToBottom("auto");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat?.messages.length, chat?.id]);

  function scrollToBottom(behavior: ScrollBehavior = "smooth") {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior });
  }

  // Pick a vision-capable model when an image is attached to a text-only model.
  // Prefers models on providers whose key is set, then non-rate-limited models.
  function findVisionModelKey(currentKey: string, keys: Partial<Record<string, string>>): string | null {
    const visionModels = MODELS.filter((m) => m.vision);
    if (visionModels.length === 0) return null;
    const withKey = visionModels.filter((m) => Boolean(keys[m.provider]));
    const working = (list: ModelDef[]) =>
      list.find((m) => m.key !== currentKey && getModelStatus(m.key) !== "rate-limited") || list[0];
    const pick = withKey.length > 0 ? working(withKey) : working(visionModels);
    return pick ? pick.key : null;
  }

  function pickImage(file: File) {
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function send(
    text: string,
    imageBase64?: string | null,
    editMsgId?: string,
    opts?: { baseMessages?: ChatMessage[]; modelKey?: string; extraImages?: string[]; replyToMsgId?: string },
  ) {
    if (!text.trim() && !imageBase64 && !opts?.extraImages?.length) return;
    let modelKey = opts?.modelKey || chat?.modelKey || DEFAULT_MODEL_KEY;
    let model = ALL_MODELS().find((m) => m.key === modelKey) || ALL_MODELS()[0];

    // Auto-switch: image attached but the selected model cannot analyze images —
    // pick a vision-capable model (working one preferred) and show a notice.
    if ((imageBase64 || opts?.extraImages?.length) && !model.vision) {
      const visionKey = findVisionModelKey(modelKey, settings.apiKeys);
      if (visionKey) {
        modelKey = visionKey;
        model = ALL_MODELS().find((m) => m.key === visionKey)!;
        setAutoSwitchNotice(`Image attached — switched to ${model.label} (vision model)`);
        // persist the switch on the chat so the header chip matches
        if (chat && (chat.modelKey || DEFAULT_MODEL_KEY) !== modelKey) {
          updateChat(chat.id, { modelKey });
        }
        setHomeModelKey(visionKey);
      }
    }
    const apiKey =
      settings.apiKeys[model.provider] ||
      // server exposes built-in env keys for each provider
      "";
    // Combine global custom instructions + per-chat system prompt into one
    // system message. Kept out of stored history so it stays editable and isn't
    // re-shown on every turn as a visible message.
    const systemText = [
      (settings.customInstructions || "").trim(),
      ((chat?.systemPrompt || "") as string).trim(),
    ]
      .filter(Boolean)
      .join("\n\n");
    const userMsg: ChatMessage = {
      id: editMsgId || genId("m"),
      role: "user",
      content: text.trim(),
      image: imageBase64 || undefined,
      images: opts?.extraImages?.length ? opts.extraImages : undefined,
      replyTo: opts?.replyToMsgId,
      createdAt: Date.now(),
    };
    let baseMessages: ChatMessage[];
    if (opts?.baseMessages) {
      baseMessages = opts.baseMessages;
    } else if (editMsgId) {
      // cut history at edit point, drop old user msg + following assistant msg
      const idx = chat!.messages.findIndex((m) => m.id === editMsgId);
      baseMessages = chat!.messages.slice(0, idx);
    } else {
      baseMessages = chat ? chat.messages : [];
    }

    const params: GenParams = {};
    if (settings.temperature != null) params.temperature = settings.temperature;
    if (settings.topP != null) params.top_p = settings.topP;
    const withSystem: ChatMessage[] = systemText
      ? [{ id: genId("s"), role: "user", content: systemText, createdAt: 0 }, ...baseMessages]
      : baseMessages;
    const targetChatId = chat?.id || createChat(modelKey).id;
    if (!chat) setActiveChatId(targetChatId);

    const assistantId = genId("m");
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      reasoning: "",
      done: false,
      createdAt: Date.now(),
    };
    const withUser = [...baseMessages, userMsg, assistantMsg];
    const isFirstReply = chat ? chat.messages.length === 0 : true;

    // ensure chat exists and apply optimistic state
    if (!chat) {
      const title = text.trim().slice(0, 40) || "New Chat";
      updateChat(targetChatId, { messages: withUser, title, modelKey, updatedAt: Date.now() });
    } else if (isFirstReply) {
      updateChat(targetChatId, { messages: withUser, updatedAt: Date.now() });
    } else {
      updateChat(targetChatId, {
        messages: withUser,
        title: chat.messages.length === 0 ? text.trim().slice(0, 40) : chat.title,
        updatedAt: Date.now(),
      });
    }

    setIsStreaming(true);
    setInput("");
    setImage(null);
    let reasoningBuf = "";
    const ctrl = new AbortController();
    (ctrl as any).userStopped = false;
    abortRef.current = ctrl;
    // The `.userStopped` flag (set by stopGeneration) tells the error handler
    // that the abort was intentional — finalize gracefully instead of showing
    // an error bubble.

    streamChat(
      model.provider,
      apiKey,
      model.key,
      withSystem,
      ctrl,
      {
        onDelta: (t) => {
          updateMessage(targetChatId, assistantId, (m) => ({ content: m.content + t }));
        },
        onReasoning: (t) => {
          reasoningBuf += t;
          updateMessage(targetChatId, assistantId, { reasoning: reasoningBuf });
        },
        onDone: () => {
          updateMessage(targetChatId, assistantId, { done: true, reasoning: reasoningBuf || undefined });
          setIsStreaming(false);
          abortRef.current = null;
          scrollToBottom();
          // Auto-generate a title from the AI after the very first reply.
          if (isFirstReply) autoTitleChat(targetChatId, modelKey, model.provider, apiKey);
        },
        onError: (msg) => {
          if (ctrl.signal.aborted && (ctrl as any).userStopped) {
            // User pressed stop — finalize with whatever was generated so far.
            updateMessage(targetChatId, assistantId, { done: true, reasoning: reasoningBuf || undefined });
            setIsStreaming(false);
            abortRef.current = null;
            return;
          }
          updateMessage(targetChatId, assistantId, { content: "", error: msg, done: true });
          setIsStreaming(false);
          scrollToBottom();
        },
      },
      { params },
    );
    if (stickToBottom) scrollToBottom();
  }

  const titleAbortRef = useRef<AbortController | null>(null);

  async function autoTitleChat(
    chatId: string,
    modelKey: string,
    provider: typeof MODELS[number]["provider"],
    apiKey: string,
  ) {
    const chatNow = chats.find((c) => c.id === chatId);
    if (!chatNow || chatNow.title !== "New Chat") return;
    const ctrl = new AbortController();
    titleAbortRef.current?.abort();
    titleAbortRef.current = ctrl;
    try {
      const title = await generateChatTitle(
        provider,
        modelKey,
        apiKey,
        chatNow.messages.map((m) => ({ role: m.role, content: m.content })),
        ctrl.signal,
      );
      if (title) renameChat(chatId, title);
    } catch {
      /* keep existing title */
    }
  }

  function stopGeneration() {
    const ctrl = abortRef.current;
    if (!ctrl) return;
    (ctrl as any).userStopped = true;
    ctrl.abort();
    // Immediately finalize UI state in case the fetch doesn't tear down fast.
    setIsStreaming(false);
    abortRef.current = null;
    scrollToBottom();
  }

  if (!chat) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex h-full flex-col items-center justify-center gap-6 overflow-y-auto p-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--asky-accent-soft)]">
            <Sparkles size={26} className="text-[var(--asky-accent)]" />
          </div>
          <h1 className="text-3xl font-semibold">How can I help?</h1>
        <p className="max-w-sm text-center text-sm text-[var(--asky-fg-muted)]">
          Ask anything. Attach an image to analyze it (works with vision-capable models).
        </p>
        <p className="max-w-sm text-center text-xs text-[var(--asky-fg-muted)]">
          Chats are saved on this device and auto-delete 3 days after the last message (pinned chats are kept).
        </p>
        <ModelChip
          model={MODELS.find((m) => m.key === homeModelKey) || MODELS[0]}
          setModelKey={(k) => setHomeModelKey(k)}
          open={showHomePicker}
          setOpen={setShowHomePicker}
          currentProviderKey={settings.apiKeys}
        />
        <div className="grid w-full max-w-2xl gap-2">
          {suggestions.map((s) => (
            <button
              key={s.text}
              onClick={() => newChat(homeModelKey)}
              className="flex items-center gap-2 rounded-xl border border-[var(--asky-border)] px-4 py-3 text-left text-sm hover:bg-[var(--asky-bg-elev)]"
            >
              {typeof s.icon === "function" ? (() => { const Icon = s.icon as unknown as typeof FileText; return <Icon size={15} className="text-[var(--asky-fg-muted)]" />; })() : <span>{s.icon}</span>}
              <span>{s.text}</span>
            </button>
          ))}
        </div>
      </div>

      {autoSwitchNotice && (
        <div className="shrink-0 border-t border-[var(--asky-border)] bg-[var(--asky-accent-soft)] px-3 py-2 text-center text-[12px] text-[var(--asky-accent)]">
          {autoSwitchNotice}
        </div>
      )}

      {/* composer */}
      <div className="shrink-0 border-t border-[var(--asky-border)] px-3 py-3">
        {(settings.templates || []).length > 0 && (
          <div className="relative mx-auto mb-1 w-full">
            <button
              onClick={() => setShowChatTemplates((v) => !v)}
              className="flex items-center gap-1 rounded-lg border border-[var(--asky-border)] bg-[var(--asky-bg-elev)] px-2 py-1 text-[11px] text-[var(--asky-fg-muted)] hover:text-[var(--asky-fg)]"
              title="Prompt templates"
            >
              <ListChecks size={12} /> Templates
            </button>
            {showChatTemplates && (
              <div className="absolute bottom-full left-0 z-20 mb-1 max-h-56 w-64 overflow-y-auto rounded-xl border border-[var(--asky-border)] bg-[var(--asky-bg-elev)] p-1 shadow-lg">
                {(settings.templates || []).map((t, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInput((p) => (p ? p + "\n" + t.content : t.content));
                      setShowChatTemplates(false);
                    }}
                    className="w-full rounded-md px-2.5 py-1.5 text-left text-[12px] hover:bg-white/5"
                  >
                    <div className="font-medium text-[var(--asky-fg)]">{t.name}</div>
                    <div className="truncate text-[10px] text-[var(--asky-fg-muted)]">{t.content}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className={`mx-auto w-full ${settings.chatWidth === "compact" ? "max-w-2xl" : "max-w-3xl"}`}>
          {image && (
            <div className="relative mb-2 inline-block">
              <img
                src={image}
                alt="attachment"
                onClick={() => setViewerSrc(image)}
                className="h-20 cursor-pointer rounded-lg border border-[var(--asky-border)] hover:opacity-90"
              />
              <button
                onClick={() => setImage(null)}
                className="absolute -right-2 -top-2 rounded-full bg-[var(--asky-bg-elev)] p-0.5"
              >
                <X size={14} />
              </button>
            </div>
          )}
          {extraImages.length > 0 && (
            <div className="mb-2 grid grid-flow-col auto-cols-max gap-2 overflow-x-auto">
              {extraImages.map((src, i) => (
                <div key={i} className="relative inline-block">
                  <img
                    src={src}
                    alt={`attachment ${i + 2}`}
                    onClick={() => setViewerSrc(src)}
                    className="h-16 cursor-pointer rounded-lg border border-[var(--asky-border)] hover:opacity-90"
                  />
                  <button
                    onClick={() => setExtraImages((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-[var(--asky-bg-elev)] p-0.5"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {(settings.templates || []).length > 0 && (
            <div className="relative mb-1">
              <button
                onClick={() => setShowTemplates((v) => !v)}
                className="flex items-center gap-1 rounded-lg border border-[var(--asky-border)] bg-[var(--asky-bg-elev)] px-2 py-1 text-[11px] text-[var(--asky-fg-muted)] hover:text-[var(--asky-fg)]"
                title="Prompt templates"
              >
                <ListChecks size={12} /> Templates
              </button>
              {showTemplates && (
                <div className="absolute bottom-full left-0 z-20 mb-1 max-h-56 w-64 overflow-y-auto rounded-xl border border-[var(--asky-border)] bg-[var(--asky-bg-elev)] p-1 shadow-lg">
                  {(settings.templates || []).map((t, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setInput((prev) => (prev ? prev + "\n" + t.content : t.content));
                        setShowTemplates(false);
                      }}
                      className="w-full rounded-md px-2.5 py-1.5 text-left text-[12px] hover:bg-white/5"
                    >
                      <div className="font-medium text-[var(--asky-fg)]">{t.name}</div>
                      <div className="truncate text-[10px] text-[var(--asky-fg-muted)]">{t.content}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex items-end gap-2 rounded-2xl border border-[var(--asky-border)] bg-[var(--asky-bg-input)] px-3 py-2">
            <label className="cursor-pointer rounded-md p-1.5 text-[var(--asky-accent)] hover:bg-white/5">
              <ImagePlus size={19} />
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => { const files = [...(e.target.files || [])]; if (files.length === 0) return; if (!image) pickImage(files[0]); if (files.length > 1) addExtraImages(files.slice(1)); e.target.value = ""; }}
              />
            </label>
                          {replyToMsg && (
                <div className="mb-1 flex items-center justify-between gap-2 rounded-lg border border-[var(--asky-accent)]/40 bg-[var(--asky-accent-soft)] px-3 py-1.5 text-[11px]">
                  <div className="min-w-0 flex-1 truncate">
                    <span className="text-[var(--asky-accent)]">Replying to:</span>{" "}
                    <span className="text-[var(--asky-fg-muted)]">{replyToMsg.content.slice(0, 90)}</span>
                  </div>
                  <button onClick={() => setReplyToMsg(null)} className="shrink-0 text-[var(--asky-fg-muted)] hover:text-[var(--asky-fg)]">
                    ✕
                  </button>
                </div>
              )}
<textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!isStreaming) {
                    send(input, image, undefined, { modelKey: homeModelKey, extraImages, replyToMsgId: replyToMsg?.id });
                    setReplyToMsg(null);
                  }
                }
                if (e.key === "ArrowUp" && !input && (e.target as HTMLTextAreaElement).selectionStart === 0) {
                  const lastUser = [...chat!.messages]
                    .reverse()
                    .find((x) => x.role === "user" && x.done);
                  if (lastUser) {
                    e.preventDefault();
                    setInput(lastUser.content);
                  }
                }
              }}
              onPaste={(e) => {
                const files = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/"));
                if (files.length === 0) return;
                e.preventDefault();
                if (!image) pickImage(files[0]);
                if (files.length > 1) addExtraImages(files.slice(1));
              }}
              rows={1}
              placeholder="Message Asky"
              className="max-h-40 flex-1 resize-none bg-transparent py-1 text-[15px] outline-none"
              style={{ lineHeight: 1.4 }}
            />
            {speechSupported() && !isStreaming && (
              <button
                onClick={toggleVoice}
                className={`mb-0.5 rounded-full p-2 ${voiceStatus === "listening" ? "animate-pulse bg-red-500/20 text-red-400" : "bg-[var(--asky-bg-elev)] text-[var(--asky-fg-muted)] hover:bg-white/5"}`}
                title={voiceStatus === "listening" ? "Stop recording" : "Voice input"}
              >
                {voiceStatus === "listening" ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
            )}
            <button
              onClick={() => { send(input, image, undefined, { modelKey: homeModelKey, extraImages, replyToMsgId: replyToMsg?.id }); setReplyToMsg(null); }}
              disabled={!input.trim() && !image && extraImages.length === 0}
              className="mb-0.5 rounded-full bg-[var(--asky-accent)] p-2 text-white hover:bg-[var(--asky-accent-hover)] disabled:opacity-30"
              title="Send"
            >
              <CornerDownLeft size={16} />
            </button>
          </div>
          <p className="mt-1.5 text-center text-[11px] text-[var(--asky-fg-muted)]">
            Asky can make mistakes. Verify important information.
          </p>
          <div className="mt-1.5 flex justify-center">
            <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-[var(--asky-fg-muted)] hover:text-[var(--asky-fg)]">
              <input
                type="checkbox"
                checked={stickToBottom}
                onChange={(e) => setStickToBottom(e.target.checked)}
                className="accent-[var(--asky-accent)]"
              />
              Stick to bottom
            </label>
          </div>
        </div>
      </div>
    </div>
    );
  }

  const model = MODELS.find((m) => m.key === chat.modelKey) || MODELS[0];
  const keySet = Boolean(settings.apiKeys[model.provider]);
  const hasContent = chat.messages.length > 0;
  useEffect(() => {
    setChatSystemPrompt(chat?.systemPrompt || "");
  }, [chat?.id]);

  return (
    <div className="flex h-full flex-col">
      {/* header */}
      <header className="flex shrink-0 items-center gap-2 border-b border-[var(--asky-border)] px-3 py-2">
        <button onClick={onToggleSidebar} className="rounded-md p-2 hover:bg-white/5 lg:hidden">
          <PanelLeft size={20} />
        </button>
        <ModelChip
          model={model}
          setModelKey={(k) => {
            updateChat(chat.id, { modelKey: k });
            if (pendingRegenFor) regenerateAssistant(pendingRegenFor, k);
          }}
          open={showPicker}
          setOpen={setShowPicker}
          currentProviderKey={settings.apiKeys}
        />
        <span className="ml-auto text-xs text-[var(--asky-fg-muted)]">
          {keySet || PROVIDERS[model.provider].hasBuiltInKey
            ? `${PROVIDERS[model.provider].label} key set`
            : "No key — add in Settings"}
        </span>
        <button
          onClick={() => setFindOpen((v) => !v)}
          className={`rounded-md p-2 hover:bg-white/5 ${findOpen ? "text-[var(--asky-accent)]" : ""}`}
          title="Find in chat (Ctrl+F)"
        >
          <Search size={18} />
        </button>
      <button
        onClick={() => {
          setChatSystemPrompt(chat?.systemPrompt || "");
          setChatSettingsOpen(true);
        }}
        className="rounded-md p-2 text-[var(--asky-fg-muted)] hover:bg-white/5 hover:text-[var(--asky-fg)]"
        title="Chat settings (system prompt)"
      >
        <Settings size={17} />
      </button>
      </header>
      {chatSettingsOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={() => setChatSettingsOpen(false)}>
          <div
            className="w-full max-w-lg rounded-2xl border border-[var(--asky-border)] bg-[var(--asky-bg-elev)] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Chat settings</h3>
              <button onClick={() => setChatSettingsOpen(false)} className="rounded-md p-1 hover:bg-white/10">
                <X size={16} />
              </button>
            </div>
            <label className="mb-1 block text-xs text-[var(--asky-fg-muted)]">
              System prompt
              <span className="ml-1 text-[10px] text-[var(--asky-fg-muted)]/70">(instructions applied to every message in this chat)</span>
            </label>
            <textarea
              value={chatSystemPrompt}
              onChange={(e) => setChatSystemPrompt(e.target.value)}
              rows={6}
              placeholder="e.g. Reply in short bullet points. Always explain like I am 12."
              className="w-full rounded-lg border border-[var(--asky-border)] bg-[var(--asky-bg-input)] p-3 text-sm outline-none focus:border-[var(--asky-accent)]"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => setChatSettingsOpen(false)}
                className="rounded-md px-3 py-1.5 text-sm hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  updateChat(chat.id, { systemPrompt: chatSystemPrompt });
                  setChatSettingsOpen(false);
                }}
                className="rounded-md bg-[var(--asky-accent)] px-3 py-1.5 text-sm text-white"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      {/* search */}
      {findOpen && (
        <div className="flex shrink-0 items-center gap-2 border-b border-[var(--asky-border)] bg-[var(--asky-bg-elev)] px-3 py-1.5">
          <Search size={14} className="text-[var(--asky-fg-muted)]" />
          <input
            autoFocus
            value={findQ}
            onChange={(e) => setFindQ(e.target.value)}
            placeholder="Find in this chat…"
            className="flex-1 bg-transparent text-sm outline-none"
          />
          <span className="text-[11px] text-[var(--asky-fg-muted)]">
            {searchInChat(findQ, chat.messages).length} match{searchInChat(findQ, chat.messages).length === 1 ? "" : "es"}
          </span>
          <button
            onClick={() => {
              setFindOpen(false);
              setFindQ("");
            }}
            className="rounded-md p-1 hover:bg-white/10"
          >
            <X size={14} />
          </button>
        </div>
      )}
      {findOpen && <FindBar query={findQ} messages={chat.messages} onClose={() => setFindOpen(false)} />}

      {/* messages */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = [...e.dataTransfer.files].find((f) => f.type.startsWith("image/"));
          if (file) pickImage(file);
        }}
      >
        <div key={`msgs-${chat?.id}`} className={`mx-auto flex ${settings.chatWidth === "compact" ? "max-w-2xl" : "max-w-3xl"} gap-5 px-4 py-6`}>
          {!hasContent && (
            <div className="flex flex-col items-center gap-3 pt-24">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--asky-accent-soft)]">
                <Sparkles size={22} className="text-[var(--asky-accent)]" />
              </div>
              <h2 className="text-2xl font-semibold">How can I help?</h2>
              <p className="max-w-sm text-center text-sm text-[var(--asky-fg-muted)]">
                Ask anything. Attach an image to analyze it (works with vision-capable models).
              </p>
            </div>
          )}
          {chat.messages.map((m) => (
            <MessageRow
              key={m.id}
              msg={m}
              isStreaming={isStreaming && !m.done}
              onCopy={async (text) => {
                await navigator.clipboard.writeText(text);
                setCopiedId(m.id);
                setTimeout(() => setCopiedId(null), 1500);
              }}
              copied={copiedId === m.id}
              copiedPng={copiedPngId === m.id}
              model={model}
              onSuggest={
                m.role === "assistant" && m.done && !isStreaming
                  ? (text) => {
                      setInput(text);
                      // send immediately on next frame so input state flushes
                      requestAnimationFrame(() => send(text, null));
                    }
                  : undefined
              }
              onExportPdf={
                m.role === "assistant" && m.done && m.content
                  ? (msg) => exportMessageToPdf(chat, msg)
                  : undefined
              }
              onCopyPng={
                m.done && m.content
                  ? async (msg) => {
                      await downloadMessagePng(chat, msg);
                      setCopiedPngId(m.id);
                      setTimeout(() => setCopiedPngId(null), 1500);
                    }
                  : undefined
              }
              onRegenerate={
                !isStreaming && m.role === "assistant" && m.done && !m.error
                  ? regenerateAssistant
                  : undefined
              }
              onOpenViewer={m.image ? (src: string) => setViewerSrc(src) : undefined}
              onPickModelRegen={
                !isStreaming && m.role === "assistant" && m.done && !m.error
                  ? (msgId) => {
                      setPendingRegenFor(msgId);
                      setShowPicker(true);
                    }
                  : undefined
              }
              regenSelected={pendingRegenFor === m.id}
              onReplyTo={m.role === "assistant" && m.done && !isStreaming ? (msg) => setReplyToMsg(msg) : undefined}
              onTogglePin={chat ? () => toggleMessagePin(chat.id, m.id) : undefined}
              onSpeak={m.role === "assistant" && m.done && !isStreaming ? speakMessage : undefined}
              ttsEnabled={settings.ttsEnabled}
              ttsSpeaking={ttsSpeakingId === m.id}
              isPinned={(chat?.pinnedMsgIds || []).includes(m.id)}
              isLastAssistant={isLastAssistantMsg(m.id)}
              onEdit={
                m.role === "user" && !isStreaming
                  ? (txt) => send(txt, m.image, m.id)
                  : m.role === "assistant" && m.error
                    ? () => {
                        // retry: find the user message right before this failed reply and resend it
                        const idx = chat!.messages.findIndex((x) => x.id === m.id);
                        const user = [...chat!.messages]
                          .slice(0, idx)
                          .reverse()
                          .find((x) => x.role === "user");
                        if (user) send(user.content, user.image, user.id);
                      }
                    : undefined
              }
            />
          ))}
        </div>
      </div>

      {/* scroll buttons */}
      <div className="pointer-events-none absolute bottom-28 right-5 flex flex-col gap-1">
        <button
          onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
          className="pointer-events-auto rounded-full border border-[var(--asky-border)] bg-[var(--asky-bg-elev)] p-1.5 shadow hover:bg-white/5"
          title="Scroll to top"
        >
          <ArrowUp size={15} />
        </button>
        <button
          onClick={() => scrollToBottom()}
          className="pointer-events-auto rounded-full border border-[var(--asky-border)] bg-[var(--asky-bg-elev)] p-1.5 shadow hover:bg-white/5"
          title="Scroll to bottom"
        >
          <ArrowDown size={15} />
        </button>
      </div>

      {/* composer */}
      <div className="shrink-0 border-t border-[var(--asky-border)] px-3 py-3">
        <div className={`mx-auto w-full ${settings.chatWidth === "compact" ? "max-w-2xl" : "max-w-3xl"}`}>
          {image && (
            <div className="relative mb-2 inline-block">
              <img
                src={image}
                alt="attachment"
                onClick={() => setViewerSrc(image)}
                className="h-20 cursor-pointer rounded-lg border border-[var(--asky-border)] hover:opacity-90"
              />
              <button
                onClick={() => setImage(null)}
                className="absolute -right-2 -top-2 rounded-full bg-[var(--asky-bg-elev)] p-0.5"
              >
                <X size={14} />
              </button>
            </div>
          )}
                    {extraImages.length > 0 && (
            <div className="mb-2 grid grid-flow-col auto-cols-max gap-2 overflow-x-auto">
              {extraImages.map((src, i) => (
                <div key={i} className="relative inline-block">
                  <img
                    src={src}
                    alt={`attachment ${i + 2}`}
                    onClick={() => setViewerSrc(src)}
                    className="h-16 cursor-pointer rounded-lg border border-[var(--asky-border)] hover:opacity-90"
                  />
                  <button
                    onClick={() => setExtraImages((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-[var(--asky-bg-elev)] p-0.5"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
<div className="flex items-end gap-2 rounded-2xl border border-[var(--asky-border)] bg-[var(--asky-bg-input)] px-3 py-2">
            <label className="cursor-pointer rounded-md p-1.5 text-[var(--asky-accent)] hover:bg-white/5">
              <ImagePlus size={19} />
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => e.target.files?.[0] && pickImage(e.target.files[0])}
              />
            </label>
                          {replyToMsg && (
                <div className="mb-1 flex items-center justify-between gap-2 rounded-lg border border-[var(--asky-accent)]/40 bg-[var(--asky-accent-soft)] px-3 py-1.5 text-[11px]">
                  <div className="min-w-0 flex-1 truncate">
                    <span className="text-[var(--asky-accent)]">Replying to:</span>{" "}
                    <span className="text-[var(--asky-fg-muted)]">{replyToMsg.content.slice(0, 90)}</span>
                  </div>
                  <button onClick={() => setReplyToMsg(null)} className="shrink-0 text-[var(--asky-fg-muted)] hover:text-[var(--asky-fg)]">
                    ✕
                  </button>
                </div>
              )}
<textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!isStreaming) {
                    send(input, image, undefined, { replyToMsgId: replyToMsg?.id });
                    setReplyToMsg(null);
                  }
                }
                // ArrowUp on empty input: pull the last sent user message for edit & resend
                if (e.key === "ArrowUp" && !input && (e.target as HTMLTextAreaElement).selectionStart === 0) {
                  const lastUser = [...chat!.messages]
                    .reverse()
                    .find((x) => x.role === "user" && x.done);
                  if (lastUser) {
                    e.preventDefault();
                    setInput(lastUser.content);
                  }
                }
              }}
              onPaste={(e) => {
                const files = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/"));
                if (files.length === 0) return;
                e.preventDefault();
                if (!image) pickImage(files[0]);
                if (files.length > 1) addExtraImages(files.slice(1));
              }}
              rows={1}
              placeholder={
                !input && [...chat.messages].reverse().find((m) => m.role === "user" && m.done)
                  ? "Message Asky (↑ edit last)"
                  : "Message Asky"
              }
              className="max-h-40 flex-1 resize-none bg-transparent py-1 text-[15px] outline-none"
              style={{ lineHeight: 1.4 }}
            />
            {isStreaming ? (
              <button
                onClick={stopGeneration}
                className="mb-0.5 rounded-full bg-[var(--asky-bg-elev)] p-2 text-[var(--asky-fg)] hover:bg-white/5"
                title="Stop generating"
              >
                <Square size={16} />
              </button>
            ) : (
              <>
                {speechSupported() && !isStreaming && (
                  <button
                    onClick={toggleVoice}
                    className={`mb-0.5 rounded-full p-2 ${voiceStatus === "listening" ? "animate-pulse bg-red-500/20 text-red-400" : "bg-[var(--asky-bg-elev)] text-[var(--asky-fg-muted)] hover:bg-white/5"}`}
                    title={voiceStatus === "listening" ? "Stop recording" : "Voice input"}
                  >
                    {voiceStatus === "listening" ? <MicOff size={16} /> : <Mic size={16} />}
                  </button>
                )}
                <button
                  onClick={() => { send(input, image, undefined, { replyToMsgId: replyToMsg?.id }); setReplyToMsg(null); }}
                  disabled={!input.trim() && !image && extraImages.length === 0}
                  className="mb-0.5 rounded-full bg-[var(--asky-accent)] p-2 text-white hover:bg-[var(--asky-accent-hover)] disabled:opacity-30"
                  title="Send"
                >
                  <CornerDownLeft size={16} />
                </button>
              </>
            )}
          </div>
          <p className="mt-1.5 text-center text-[11px] text-[var(--asky-fg-muted)]">
            Asky can make mistakes. Verify important information.
          </p>
        </div>
      </div>
      {viewerSrc && <ImageViewer src={viewerSrc} onClose={() => setViewerSrc(null)} />}
    </div>
  );
}

/**
 * In-chat find results panel: lists matches across messages and scrolls to each one.
 */
function FindBar({
  query,
  messages,
  onClose,
}: {
  query: string;
  messages: ChatMessage[];
  onClose: () => void;
}) {
  const hits = searchInChat(query, messages);
  if (!query.trim() || hits.length === 0) {
    return null;
  }
  return (
    <div className="max-h-48 shrink-0 overflow-y-auto border-b border-[var(--asky-border)] bg-[var(--asky-bg-elev)] px-3 py-1.5">
      {hits.map((h, i) => {
        const msg = messages.find((m) => m.id === h.msgId);
        if (!msg) return null;
        return (
          <button
            key={`${h.msgId}-${h.start}-${i}`}
            onClick={() => {
              const el = document.querySelector(`[data-msg-id="${h.msgId}"]`);
              el?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
            className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-white/10"
          >
            <span className="mt-0.5 shrink-0 rounded bg-[var(--asky-accent-soft)] px-1 text-[10px] font-semibold uppercase text-[var(--asky-accent)]">
              {msg.role === "user" ? "You" : "Asky"}
            </span>
            <span className="min-w-0 flex-1 truncate text-[var(--asky-fg-muted)]">{h.snippet}</span>
          </button>
        );
      })}
    </div>
  );
}

function ModelChip({
  model,
  setModelKey,
  open,
  setOpen,
  currentProviderKey,
}: {
  model: ModelDef;
  setModelKey: (k: string) => void;
  open: boolean;
  setOpen: (v: boolean) => void;
  currentProviderKey: Partial<Record<string, string>>;
}) {
  const { settings, toggleFavorite, renameModel } = useApp();
  const chipStatus = getModelStatus(model.key);
  const displayName = (settings.nicknames && settings.nicknames[model.key]) || model.label;
  const isFavorite = (settings.favoriteModelKeys || []).includes(model.key);
  const customSection: ModelDef[] = (settings.customModels || [])
    .filter((c) => Boolean(currentProviderKey[c.provider]))
    .map((c) => ({
      key: c.id,
      provider: c.provider as ProviderKey,
      label: c.label,
      id: c.modelId,
      vision: Boolean(c.vision),
      custom: true,
    }));
  const keySet = Boolean(currentProviderKey[model.provider]) || Boolean(PROVIDERS[model.provider].hasBuiltInKey);
  // When the current model is rate-limited, highlight the next working model of the same provider.
  const suggestKey: string | null =
    keySet && chipStatus === "rate-limited"
      ? MODELS.find((m) => m.provider === model.provider && getModelStatus(m.key) !== "rate-limited")?.key ?? null
      : null;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium hover:bg-white/5"
      >
        <span className="text-[var(--asky-fg)]">{displayName}</span>
        <span className="text-xs text-[var(--asky-fg-muted)]">
          {PROVIDERS[model.provider].label}
        </span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" className="text-[var(--asky-fg-muted)]">
          <path d="M2 3.5 L5 6.5 L8 3.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-xl border border-[var(--asky-border)] bg-[var(--asky-bg-elev)] py-2 shadow-xl">
            {chipStatus === "rate-limited" && suggestKey && (
              <div className="flex items-center gap-2 border-b border-[var(--asky-border)] bg-red-500/10 px-3 py-2">
                <span className="text-[12px] text-red-400">{model.label} hit its limit.</span>
                <button
                  className="rounded-md bg-red-500/90 px-2 py-1 text-[11px] font-medium text-white hover:opacity-90"
                  onClick={() => {
                    setModelKey(suggestKey);
                    setOpen(false);
                  }}
                >
                  Switch to working model
                </button>
              </div>
            )}
            {(() => {
              const favs = ALL_MODELS().filter(
                (m) => (settings.favoriteModelKeys || []).includes(m.key),
              );
              return favs.length > 0 ? (
                <div key="favorites">
                  <div className="flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--asky-fg-muted)]">
                    <span>Favorites</span>
                    <span className="text-amber-400">★</span>
                  </div>
                  {favs.map((m) => (
                    <ModelOptionRow
                      key={m.key}
                      model={m}
                      currentModelKey={model.key}
                      currentProviderKey={currentProviderKey}
                      onPick={setModelKey}
                      onDone={() => setOpen(false)}
                    />
                  ))}
                </div>
              ) : null;
            })()}
            {(["nvidia", "mistral", "groq", "openrouter", "opencode"] as const).map((pk) => (
              <div key={pk}>
                <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--asky-fg-muted)]">
                  {PROVIDERS[pk].label}
                </div>
                {MODELS.filter((m) => m.provider === pk).map((m) => (
                  <ModelOptionRow
                    key={m.key}
                    model={m}
                    currentModelKey={model.key}
                    currentProviderKey={currentProviderKey}
                    onPick={setModelKey}
                    onDone={() => setOpen(false)}
                  />
                ))}
              </div>
            ))}
            {customSection.length > 0 && (
              <div key="custom">
                <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--asky-fg-muted)]">
                  Custom models
                </div>
                {customSection.map((m) => (
                  <ModelOptionRow
                    key={m.key}
                    model={m}
                    currentModelKey={model.key}
                    currentProviderKey={currentProviderKey}
                    onPick={setModelKey}
                    onDone={() => setOpen(false)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ModelOptionRow({
  model,
  currentModelKey,
  currentProviderKey,
  onPick,
  onDone,
}: {
  model: ModelDef;
  currentModelKey: string;
  currentProviderKey: Partial<Record<string, string>>;
  onPick: (k: string) => void;
  onDone: () => void;
}) {
  const { settings, toggleFavorite, renameModel } = useApp();
  const hasKey = Boolean(currentProviderKey[model.provider]) || Boolean(PROVIDERS[model.provider].hasBuiltInKey);
  const status = hasKey ? getModelStatus(model.key) : "unknown";
  const rateLimited = status === "rate-limited";
  const displayName = (settings.nicknames && settings.nicknames[model.key]) || model.label;
  const isFavorite = (settings.favoriteModelKeys || []).includes(model.key);
  return (
    <button
      disabled={!hasKey}
      onClick={() => {
        onPick(model.key);
        onDone();
      }}
      onContextMenu={(e) => e.preventDefault()}
      className={`group flex w-full items-center justify-between px-3 py-1.5 text-sm hover:bg-white/5 ${
        model.key === currentModelKey ? "bg-[var(--asky-accent-soft)]" : ""
      } ${!hasKey ? "cursor-not-allowed opacity-40" : ""}`}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate">{displayName}</span>
        {model.vision && <ImagePlus size={12} className="shrink-0 text-[var(--asky-fg-muted)]" />}
        {rateLimited && <span className="shrink-0 text-[11px] text-[var(--asky-error)]">limit hit</span>}
        <Star
          size={12}
          className={`shrink-0 ${isFavorite ? "text-amber-400" : "text-transparent group-hover:text-[var(--asky-fg-muted)]/60"}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(model.key);
          }}
        />
        <Pencil
          size={12}
          className="hidden shrink-0 text-[var(--asky-fg-muted)]/60 group-hover:block"
          onClick={(e) => {
            e.stopPropagation();
            const cur = (settings.nicknames && settings.nicknames[model.key]) || "";
            const next = window.prompt(`Nickname for ${model.label} (leave empty to reset):`, cur);
            if (next !== null) renameModel(model.key, next.trim());
          }}
        />
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            status === "ok" ? "bg-green-400" : status === "rate-limited" ? "bg-red-400" : "bg-[var(--asky-fg-muted)]/40"
          }`}
          title={
            status === "ok"
              ? "Working"
              : status === "rate-limited"
                ? "Daily limit hit — switch to another model"
                : "Not tested yet"
          }
        />
        {!hasKey && <span className="text-[11px] text-[var(--asky-fg-muted)]">add key</span>}
      </span>
    </button>
  );
}

function MessageRow({
  msg,
  isStreaming,
  onCopy,
  copied,
  model,
  onEdit,
  onSuggest,
  onExportPdf,
  onCopyPng,
  copiedPng,
  onRegenerate,
  onPickModelRegen,
  regenSelected,
  onOpenViewer,
  onReplyTo,
  onTogglePin,
  onSpeak,
  ttsEnabled,
  ttsSpeaking,
  isPinned,
  chatId,
  isLastAssistant,
}: {
  msg: ChatMessage;
  isStreaming: boolean;
  onCopy: (text: string) => void;
  copied: boolean;
  model: ModelDef;
  onEdit?: (text: string) => void;
  onSuggest?: (text: string) => void;
  onExportPdf?: (msg: ChatMessage) => void;
  onCopyPng?: (msg: ChatMessage) => void;
  copiedPng?: boolean;
  onRegenerate?: (msgId: string) => void;
  onPickModelRegen?: (msgId: string) => void;
  regenSelected?: boolean;
  onOpenViewer?: (src: string) => void;
  onReplyTo?: (msg: ChatMessage) => void;
  onTogglePin?: () => void;
  onSpeak?: (msg: ChatMessage) => void;
  ttsEnabled?: boolean;
  ttsSpeaking?: boolean;
  isPinned?: boolean;
  chatId?: string;
  isLastAssistant?: boolean;
}) {
  const { settings } = useApp();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(msg.content);
  const [collapsed, setCollapsed] = useState(false);
  const user = msg.role === "user";
  const fontCls =
    settings.fontSize === "small" ? "text-[13px]" : settings.fontSize === "large" ? "text-base" : "text-[15px]";
  const lenWords = msg.content
    ? msg.content.replace(/\s+/g, " ").trim().split(/\s+/).filter(Boolean).length
    : 0;
  const lenChars = msg.content ? msg.content.length : 0;
  const canCollapse = !user && msg.content.length > 800;
  const plainText = (html: string) => {
    if (!html) return "";
    const doc = new DOMParser().parseFromString(html, "text/html");
    return doc.body.textContent || "";
  };

  if (user) {
    return (
      <div data-msg-id={msg.id} className="flex justify-end">
        <div data-testid="user-msg" className="max-w-[85%] rounded-2xl bg-[var(--asky-bg-input)] px-4 py-2.5">
          {editing ? (
            <div className="flex flex-col gap-1">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="w-full bg-transparent text-sm outline-none"
                rows={3}
              />
              <div className="flex justify-end gap-2">
                <button className="rounded-md px-2 py-1 text-xs hover:bg-white/10" onClick={() => setEditing(false)}>
                  Cancel
                </button>
                <button
                  className="rounded-md bg-[var(--asky-accent)] px-2 py-1 text-xs text-white"
                  onClick={() => {
                    setEditing(false);
                    onEdit?.(draft);
                  }}
                >
                  Send again
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className={`whitespace-pre-wrap leading-relaxed ${fontCls}`}>{msg.content}</div>
              {msg.image && (
                <img
                  src={msg.image}
                  alt="attachment"
                  onClick={() => {
                    if (msg.image) onOpenViewer?.(msg.image);
                  }}
                  className="mt-2 max-h-48 cursor-pointer rounded-lg hover:opacity-90"
                />
              )}
              {(msg.images || []).length > 0 && (
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  {msg.images!.map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt={`attachment ${i + 2}`}
                      onClick={() => onOpenViewer?.(src)}
                      className="max-h-28 cursor-pointer rounded-lg border border-[var(--asky-border)] hover:opacity-90"
                    />
                  ))}
                </div>
              )}
              <div className="mt-1 flex items-center gap-2">
                {onEdit && (
                  <button
                    className="text-[11px] text-[var(--asky-fg-muted)] hover:text-[var(--asky-fg)]"
                    onClick={() => {
                      setDraft(msg.content);
                      setEditing(true);
                    }}
                  >
                    Edit & resend
                  </button>
                )}
                {onReplyTo && (
                  <button
                    className="flex items-center gap-0.5 text-[11px] text-[var(--asky-fg-muted)] hover:text-[var(--asky-fg)]"
                    onClick={() => onReplyTo(msg)}
                    title="Reply to this message"
                  >
                    <CornerDownRight size={10} /> Reply
                  </button>
                )}
                <span className="text-[10px] text-[var(--asky-fg-muted)]/60">
                  {lenWords} words · {lenChars} chars
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  if (msg.error) {
    return (
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--asky-accent-soft)]">
          <Sparkles size={15} className="text-[var(--asky-accent)]" />
        </div>
        <div data-testid="error-msg" data-msg-id={msg.id} className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          <p className="mb-1 font-medium">Couldn't get a reply</p>
          <p className="text-red-300/80">{msg.error}</p>
          {onEdit && (
            <button
              className="mt-1.5 text-[11px] text-red-200 hover:text-red-100"
              onClick={() => onEdit?.("")}
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

    const hasReasoning = msg.reasoning && msg.reasoning.trim().length > 0;
  return (
    <div data-testid="assistant-msg" data-msg-id={msg.id} className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--asky-accent-soft)]">
        <Sparkles size={15} className="text-[var(--asky-accent)]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="msg-body text-[15px] leading-relaxed">
          {hasReasoning && (
            <details className="mb-1 rounded-lg border border-[var(--asky-border)] bg-[var(--asky-bg-elev)]">
              <summary className="cursor-pointer px-3 py-1.5 text-xs text-[var(--asky-fg-muted)]">
                {isStreaming ? "Thinking…" : "Thought for a moment"}
              </summary>
              <div className="border-t border-[var(--asky-border)] px-3 py-2 text-sm text-[var(--asky-fg-muted)]">
                {msg.reasoning}
              </div>
            </details>
          )}
          {!msg.content && isStreaming && !hasReasoning ? (
            <span className="blink-caret" />
          ) : collapsed ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm italic text-[var(--asky-fg-muted)]">Long reply ({lenWords} words)</span>
              <button
                className="rounded-md px-2 py-1 text-[11px] text-[var(--asky-accent)] hover:bg-white/5"
                onClick={() => setCollapsed(false)}
              >
                Show full reply
              </button>
            </div>
          ) : (
            <div className={fontCls} dangerouslySetInnerHTML={{ __html: renderMd(msg.content) }} />
          )}
          {msg.image && (
            <img
              src={msg.image}
              alt="seen"
              onClick={() => {
                if (msg.image) onOpenViewer?.(msg.image);
              }}
              className="mt-2 max-h-48 cursor-pointer rounded-lg hover:opacity-90"
            />
          )}
          {(msg.images || []).length > 0 && (
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {msg.images!.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt={`attachment ${i + 2}`}
                  onClick={() => onOpenViewer?.(src)}
                  className="max-h-28 cursor-pointer rounded-lg border border-[var(--asky-border)] hover:opacity-90"
                />
              ))}
            </div>
          )}
        </div>
        {!isStreaming && msg.done && msg.content && (
          <div className="mt-1 flex flex-wrap gap-2">
            <button
              onClick={() => onCopy(msg.content)}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-[var(--asky-fg-muted)] hover:bg-white/5 hover:text-[var(--asky-fg)]"
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              onClick={() => onExportPdf?.(msg)}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-[var(--asky-fg-muted)] hover:bg-white/5 hover:text-[var(--asky-fg)]"
              title="Save reply as PDF"
            >
              🖨️ PDF
            </button>
            {onCopyPng && (
              <button
                onClick={() => onCopyPng(msg)}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-[var(--asky-fg-muted)] hover:bg-white/5 hover:text-[var(--asky-fg)]"
                title="Save reply as image (PNG)"
              >
                {copiedPng ? <Check size={11} /> : <Image size={11} />}
                {copiedPng ? "Saved" : "PNG"}
              </button>
            )}
            {ttsEnabled && onSpeak && (
              <button
                onClick={() => onSpeak(msg)}
                className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] hover:bg-white/5 ${
                  ttsSpeaking ? "text-[var(--asky-accent)]" : "text-[var(--asky-fg-muted)] hover:text-[var(--asky-fg)]"
                }`}
                title="Listen to this reply"
              >
                {ttsSpeaking ? <VolumeX size={11} /> : <Volume2 size={11} />}
                {ttsSpeaking ? "Stop" : "Speak"}
              </button>
            )}
            {onTogglePin && (
              <button
                onClick={onTogglePin}
                className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] ${
                  isPinned ? "text-amber-400" : "text-[var(--asky-fg-muted)] hover:bg-white/5 hover:text-[var(--asky-fg)]"
                }`}
                title={isPinned ? "Unpin this message" : "Pin this message"}
              >
                {isPinned ? <BookmarkCheck size={11} /> : <Bookmark size={11} />}
                {isPinned ? "Pinned" : "Pin"}
              </button>
            )}
            {canCollapse && (
              <button
                onClick={() => setCollapsed(true)}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-[var(--asky-fg-muted)] hover:bg-white/5 hover:text-[var(--asky-fg)]"
                title="Collapse this reply"
              >
                <ChevronsDownUp size={11} /> Collapse
              </button>
            )}
            {!isStreaming && onRegenerate && (
              <>
                <button
                  onClick={() => onRegenerate(msg.id)}
                  className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-[var(--asky-fg-muted)] hover:bg-white/5 hover:text-[var(--asky-fg)]"
                  title="Regenerate this reply with the same model"
                >
                  <RefreshCcw size={11} /> Regen
                </button>
                <button
                  onClick={() => onPickModelRegen?.(msg.id)}
                  className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] ${regenSelected ? "bg-[var(--asky-accent-soft)] text-[var(--asky-accent)]" : "text-[var(--asky-fg-muted)] hover:bg-white/5 hover:text-[var(--asky-fg)]"}`}
                  title="Regenerate with a different model — pick one from the model list above"
                >
                  <RefreshCcw size={11} /> Model…
                </button>
              </>
            )}
            <span className="text-[10px] text-[var(--asky-fg-muted)]/60">
              {lenWords} words · {lenChars} chars
            </span>
          </div>
        )}
        {!isStreaming && msg.done && msg.content && onSuggest && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {followUpSuggestions(msg.content).map((s) => (
              <button
                key={s}
                onClick={() => onSuggest(s)}
                className="rounded-full border border-[var(--asky-accent)]/30 bg-[var(--asky-accent-soft)] px-2.5 py-1 text-[11px] text-[var(--asky-accent)] hover:bg-[var(--asky-accent)] hover:text-white"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

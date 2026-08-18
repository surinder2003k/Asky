import { useEffect, useRef, useState } from "react";
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
import { useApp } from "../store";
import { MODELS, PROVIDERS, DEFAULT_MODEL_KEY, type ModelDef } from "../providers";
import { streamChat } from "../ai";
import type { ChatMessage } from "../storage";
import { genId } from "../storage";

marked.setOptions({ breaks: true });

function renderMd(text: string) {
  const raw = marked.parse(text || "") as string;
  return DOMPurify.sanitize(raw);
}

const SUGGESTIONS = [
  { icon: "📝", text: "Help me write a professional resume from my details" },
  { icon: "🌐", text: "What are the latest AI trends this year?" },
  { icon: "📅", text: "Plan a productive morning routine for me" },
  { icon: "🎨", text: "Write a short sci-fi story about a time traveler" },
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
    setActiveChatId,
  } = useApp();
  const [input, setInput] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (scrollAtBottom.current) scrollToBottom("auto");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat?.messages.length, chat?.id]);

  function scrollToBottom(behavior: ScrollBehavior = "smooth") {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior });
  }

  function pickImage(file: File) {
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function send(text: string, imageBase64?: string | null, editMsgId?: string) {
    if (!text.trim() && !imageBase64) return;
    const modelKey = chat?.modelKey || DEFAULT_MODEL_KEY;
    const model = MODELS.find((m) => m.key === modelKey) || MODELS[0];
    const apiKey =
      settings.apiKeys[model.provider] ||
      // server exposes built-in env keys for each provider
      "";
    const userMsg: ChatMessage = {
      id: editMsgId || genId("m"),
      role: "user",
      content: text.trim(),
      image: imageBase64 || undefined,
      createdAt: Date.now(),
    };
    let baseMessages: ChatMessage[];
    if (editMsgId) {
      // cut history at edit point, drop old user msg + following assistant msg
      const idx = chat!.messages.findIndex((m) => m.id === editMsgId);
      baseMessages = chat!.messages.slice(0, idx);
    } else {
      baseMessages = chat ? chat.messages : [];
    }

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

    // ensure chat exists and apply optimistic state
    if (!chat) {
      const title = text.trim().slice(0, 40) || "New Chat";
      updateChat(targetChatId, { messages: withUser, title, modelKey, updatedAt: Date.now() });
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
      withUser,
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
          abortRef.current = null;
        },
      },
    );
    scrollToBottom();
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
        <div className="flex h-full flex-col items-center justify-center gap-6 p-6">
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
        <div className="grid w-full max-w-2xl gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.text}
              onClick={() => newChat()}
              className="flex items-center gap-2 rounded-xl border border-[var(--asky-border)] px-4 py-3 text-left text-sm hover:bg-[var(--asky-bg-elev)]"
            >
              <span>{s.icon}</span>
              <span>{s.text}</span>
            </button>
          ))}
        </div>
      </div>

      {/* composer */}
      <div className="shrink-0 border-t border-[var(--asky-border)] px-3 py-3">
        <div className="mx-auto w-full max-w-3xl">
          {image && (
            <div className="relative mb-2 inline-block">
              <img src={image} alt="attachment" className="h-20 rounded-lg border border-[var(--asky-border)]" />
              <button
                onClick={() => setImage(null)}
                className="absolute -right-2 -top-2 rounded-full bg-[var(--asky-bg-elev)] p-0.5"
              >
                <X size={14} />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2 rounded-2xl border border-[var(--asky-border)] bg-[var(--asky-bg-input)] px-3 py-2">
            <label className="cursor-pointer rounded-md p-1.5 text-[var(--asky-accent)] hover:bg-white/5">
              <ImagePlus size={19} />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && pickImage(e.target.files[0])}
              />
            </label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!isStreaming) send(input, image);
                }
              }}
              rows={1}
              placeholder="Message Asky"
              className="max-h-40 flex-1 resize-none bg-transparent py-1 text-[15px] outline-none"
              style={{ lineHeight: 1.4 }}
            />
            <button
              onClick={() => send(input, image)}
              disabled={!input.trim() && !image}
              className="mb-0.5 rounded-full bg-[var(--asky-accent)] p-2 text-white hover:bg-[var(--asky-accent-hover)] disabled:opacity-30"
              title="Send"
            >
              <CornerDownLeft size={16} />
            </button>
          </div>
          <p className="mt-1.5 text-center text-[11px] text-[var(--asky-fg-muted)]">
            Asky can make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </div>
    );
  }

  const model = MODELS.find((m) => m.key === chat.modelKey) || MODELS[0];
  const keySet = Boolean(settings.apiKeys[model.provider]);
  const hasContent = chat.messages.length > 0;

  return (
    <div className="flex h-full flex-col">
      {/* header */}
      <header className="flex shrink-0 items-center gap-2 border-b border-[var(--asky-border)] px-3 py-2">
        <button onClick={onToggleSidebar} className="rounded-md p-2 hover:bg-white/5 lg:hidden">
          <PanelLeft size={20} />
        </button>
        <ModelChip
          model={model}
          setModelKey={(k) => updateChat(chat.id, { modelKey: k })}
          open={showPicker}
          setOpen={setShowPicker}
          currentProviderKey={settings.apiKeys}
        />
        <span className="ml-auto text-xs text-[var(--asky-fg-muted)]">
          {keySet || PROVIDERS[model.provider].hasBuiltInKey
            ? `${PROVIDERS[model.provider].label} key set`
            : "No key — add in Settings"}
        </span>
      </header>

      {/* messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6">
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
              model={model}
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
        <div className="mx-auto w-full max-w-3xl">
          {image && (
            <div className="relative mb-2 inline-block">
              <img src={image} alt="attachment" className="h-20 rounded-lg border border-[var(--asky-border)]" />
              <button
                onClick={() => setImage(null)}
                className="absolute -right-2 -top-2 rounded-full bg-[var(--asky-bg-elev)] p-0.5"
              >
                <X size={14} />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2 rounded-2xl border border-[var(--asky-border)] bg-[var(--asky-bg-input)] px-3 py-2">
            <label className="cursor-pointer rounded-md p-1.5 text-[var(--asky-accent)] hover:bg-white/5">
              <ImagePlus size={19} />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && pickImage(e.target.files[0])}
              />
            </label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!isStreaming) send(input, image);
                }
              }}
              rows={1}
              placeholder="Message Asky"
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
              <button
                onClick={() => send(input, image)}
                disabled={!input.trim() && !image}
                className="mb-0.5 rounded-full bg-[var(--asky-accent)] p-2 text-white hover:bg-[var(--asky-accent-hover)] disabled:opacity-30"
                title="Send"
              >
                <CornerDownLeft size={16} />
              </button>
            )}
          </div>
          <p className="mt-1.5 text-center text-[11px] text-[var(--asky-fg-muted)]">
            Asky can make mistakes. Verify important information.
          </p>
        </div>
      </div>
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
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium hover:bg-white/5"
      >
        <span className="text-[var(--asky-fg)]">{model.label}</span>
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
            {(["nvidia", "mistral", "groq", "openrouter", "opencode"] as const).map((pk) => (
              <div key={pk}>
                <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--asky-fg-muted)]">
                  {PROVIDERS[pk].label}
                </div>
                {MODELS.filter((m) => m.provider === pk).map((m) => {
                  const hasKey = Boolean(currentProviderKey[pk]) || Boolean(PROVIDERS[pk].hasBuiltInKey);
                  const disabled = !hasKey;
                  return (
                    <button
                      key={m.key}
                      disabled={disabled}
                      onClick={() => {
                        setModelKey(m.key);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center justify-between px-3 py-1.5 text-sm hover:bg-white/5 ${
                        m.key === model.key ? "bg-[var(--asky-accent-soft)]" : ""
                      } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
                    >
                      <span className="flex items-center gap-1.5">
                        {m.label}
                        {m.vision && <ImagePlus size={12} className="text-[var(--asky-fg-muted)]" />}
                      </span>
                      {!hasKey && <span className="text-[11px] text-[var(--asky-fg-muted)]">add key</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MessageRow({
  msg,
  isStreaming,
  onCopy,
  copied,
  model,
  onEdit,
}: {
  msg: ChatMessage;
  isStreaming: boolean;
  onCopy: (text: string) => void;
  copied: boolean;
  model: ModelDef;
  onEdit?: (text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(msg.content);
  const user = msg.role === "user";

  if (user) {
    return (
      <div className="flex justify-end">
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
              <div className="whitespace-pre-wrap text-[15px] leading-relaxed">{msg.content}</div>
              {msg.image && (
                <img src={msg.image} alt="attachment" className="mt-2 max-h-48 rounded-lg" />
              )}
              {onEdit && (
                <button
                  className="mt-1 text-[11px] text-[var(--asky-fg-muted)] hover:text-[var(--asky-fg)]"
                  onClick={() => {
                    setDraft(msg.content);
                    setEditing(true);
                  }}
                >
                  Edit & resend
                </button>
              )}
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
        <div data-testid="error-msg" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
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
    <div data-testid="assistant-msg" className="flex items-start gap-3">
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
          ) : (
            <div dangerouslySetInnerHTML={{ __html: renderMd(msg.content) }} />
          )}
          {msg.image && <img src={msg.image} alt="seen" className="mt-2 max-h-48 rounded-lg" />}
        </div>
        {!isStreaming && msg.done && msg.content && (
          <div className="mt-1 flex gap-2">
            <button
              onClick={() => onCopy(msg.content)}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-[var(--asky-fg-muted)] hover:bg-white/5 hover:text-[var(--asky-fg)]"
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

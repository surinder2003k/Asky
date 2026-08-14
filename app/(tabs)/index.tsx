import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import * as Speech from "expo-speech";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenContainer } from "@/components/screen-container";
import { ModelPicker } from "@/components/model-picker";
import { SettingsModal } from "@/components/settings-modal";
import { HistorySheet } from "@/components/history-sheet";
import { TemplatesSheet } from "@/components/templates-sheet";
import { CompareSheet } from "@/components/compare-sheet";
import { MessageText } from "@/components/message-text";
import { SwipeMessageRow } from "@/components/swipe-message-row";
import { CanvasScreen } from "@/components/canvas-screen";
import { GenAudioBubble } from "@/components/gen-audio-bubble";
import { RemindersSheet } from "@/components/reminders-sheet";
import { ResumeSheet } from "@/components/resume-sheet";
import { DebateSheet } from "@/components/debate-sheet";
import { KbSheet } from "@/components/kb-sheet";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { setBusyModel } from "@/lib/busy-model";
import { useVoiceDictation } from "@/hooks/use-voice-dictation";
import { streamChat, type ImageAttachment, isNvidiaImageModel, isNvidiaAudioModel, generateImage, generateAudio, extractPdfText, getBase } from "@/lib/ai";
import { imageToBase64 } from "@/lib/image";
import { getModel, getModelSourceLabel, MODELS } from "@/lib/providers";
import { useConnectivity } from "@/lib/use-connectivity";
import { getOfflineQueue, enqueueOfflineMessage, removeOfflineMessage, type OfflineMessage } from "@/lib/offline-draft";
import { checkForUpdates } from "@/lib/remote-config";
import {
  type Conversation,
  addMessage,
  appendAssistantText,
  clearConversations,
  createConversation,
  deleteConversation,
  getConversations,
  getSettings,
  isExpired,
  markAssistantError,
  setRawConversationList,
  AUTO_DELETE_DAYS,
  getConversation,
} from "@/lib/storage";
import {
  getCloudSyncEnabled,
  requestSync,
  setCloudSyncEnabled,
} from "@/lib/cloud-sync";
import { useThemeContext } from "@/lib/theme-provider";
import type { ChatMode } from "@/lib/modes";
import { getModePrompt, MODE_LABELS, MODE_DESCRIPTIONS, TRANSLATE_TARGETS } from "@/lib/modes";
import { ModesSheet } from "@/components/modes-sheet";
import { useFontSize } from "@/lib/font-size";

const DEFAULT_SYSTEM_PROMPT =
  "You are a friendly, concise AI assistant. Reply naturally. Use short paragraphs. Use **bold** for emphasis and ```code``` blocks for code when helpful.";

let cachedSystemPrompt: string | null = null;

/**
 * Returns the user's custom system prompt if set, otherwise the default.
 * Reloaded once per app session after a send; cleared whenever Settings saves.
 */
export function getEffectiveSystemPrompt(): string {
  if (cachedSystemPrompt === null) return DEFAULT_SYSTEM_PROMPT;
  return cachedSystemPrompt.trim() || DEFAULT_SYSTEM_PROMPT;
}

/**
 * Resolves the full system prompt for a conversation: chat template persona
 * (if applied) takes precedence over the global custom prompt.
 */
export async function getConversationSystemPrompt(
  templateId: string | undefined,
  chatMode?: ChatMode,
  translateTarget?: string,
): Promise<string> {
  const { getTemplate } = awaitGetTemplates();
  const tpl = getTemplate(templateId ?? "");
  const base = tpl ? tpl.systemPrompt : getEffectiveSystemPrompt();
  const modeSuffix = getModePrompt(chatMode, translateTarget);
  const parts: string[] = [base, modeSuffix];
  // Web search toggle: instruct the model to use live web search when useful
  const { getWebSearchEnabled, getKbContextText } = await import("@/lib/storage");
  if (await getWebSearchEnabled()) {
    parts.push(
      "\nYou have access to live web search. When the user asks for current, factual, or time-sensitive information, search the web and cite sources as inline links.",
    );
  }
  // Knowledge base: user's saved personal docs used as context in every chat
  const kbText = await getKbContextText();
  if (kbText) parts.push("\n" + kbText);
  return parts.join("");
}

let _templatesModule: { getTemplate: (id: string) => { systemPrompt: string } | undefined } | null = null;
function awaitGetTemplates() {
  // Lazily loaded once; kept sync-friendly for the message-building helpers.
  if (!_templatesModule) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _templatesModule = require("@/lib/templates") as {
      getTemplate: (id: string) => { systemPrompt: string } | undefined;
    };
  }
  return _templatesModule;
}

export async function reloadSystemPrompt(): Promise<string> {
  const custom = await (async () => {
    const { getCustomSystemPrompt } = await import("@/lib/storage");
    return getCustomSystemPrompt();
  })();
  cachedSystemPrompt = custom;
  return getEffectiveSystemPrompt();
}

const WELCOME_PROMPTS: { emoji: string; text: string }[] = [
  { emoji: "✍️", text: "Write a Python function to check if a string is a palindrome" },
  { emoji: "📝", text: "Summarize the theory of relativity in simple words" },
  { emoji: "💡", text: "Give me 5 ideas for a small weekend project" },
  { emoji: "📅", text: "Plan a productive morning routine for me" },
  { emoji: "🎯", text: "Help me write a professional resume from my details" },
  { emoji: "🖼️", text: "Generate an image of a futuristic city at sunset" },
  { emoji: "🧮", text: "Solve this step by step: what is the derivative of x^2 * ln(x)?" },
  { emoji: "🌐", text: "What are the latest AI trends this year?" },
  { emoji: "🍳", text: "Give me a quick 15-minute healthy dinner recipe" },
  { emoji: "📚", text: "Explain quantum entanglement like I'm 10 years old" },
  { emoji: "✈️", text: "Plan a 3-day trip to Goa on a budget" },
  { emoji: "💻", text: "Build me a landing page for a coffee shop" },
  { emoji: "🎨", text: "Write a short sci-fi story about a time traveler" },
  { emoji: "🧠", text: "Give me a 4-week workout plan for beginners" },
  { emoji: "📊", text: "Compare the top 3 free AI APIs I can use" },
  { emoji: "🗣️", text: "Translate this to Spanish: Where is the nearest metro station?" },
];

function pickWelcomePrompts(): { emoji: string; text: string }[] {
  const copy = [...WELCOME_PROMPTS];
  const picks: { emoji: string; text: string }[] = [];
  for (let i = 0; i < 4 && copy.length > 0; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    picks.push(copy.splice(idx, 1)[0]);
  }
  return picks;
}

/** Handle slash commands; returns true if the command was dispatched. */
async function dispatchSlashCommand(text: string): Promise<boolean> {
  // Handled by the ChatScreen context; implemented via returned promise below.
  return await handleSlashCommand(text);
}

let slashHandler: ((text: string) => boolean | Promise<boolean>) | null = null;
export function setSlashHandler(handler: (text: string) => boolean | Promise<boolean>): void {
  slashHandler = handler;
}

/** Model display names for debate opponent labels (module-level, no hooks). */
const DEBATE_MODEL_NAMES: Record<string, string> = {};
export async function getDebateName(modelKey: string): Promise<string> {
  if (DEBATE_MODEL_NAMES[modelKey]) return DEBATE_MODEL_NAMES[modelKey];
  try {
    const { getModels } = await import("@/lib/remote-config");
    const models = await getModels();
    const found = models.find((m) => m.id === modelKey);
    DEBATE_MODEL_NAMES[modelKey] = found?.name ?? modelKey;
    return DEBATE_MODEL_NAMES[modelKey];
  } catch {
    return modelKey;
  }
}
export async function handleSlashCommand(text: string): Promise<boolean> {
  const t = text.trim().toLowerCase();
  if (!t.startsWith("/")) return false;
  if (slashHandler) return await Promise.resolve(slashHandler(t));
  return false;
}

type DisplayMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  error?: boolean;
  imageUri?: string;
  createdAt?: number;
  /** Model source badge shown on assistant rows (e.g. "Mistral Small · Mistral"); null until the reply finishes. */
  source?: string | null;
  /** Offline queue draft — grey pill, not yet sent */
  offlineDraft?: boolean;
  /** Base64 of an AI-generated image/audio returned by a generation model */
  genMedia?: { base64: string; type: "image" | "audio" };
  /** While a generation model is working */
  genProgress?: string;
};

function messageTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hh = d.getHours();
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ampm = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 || 12;
  const base = `${h12}:${mm} ${ampm}`;
  if (sameDay) return base;
  return `${d.getDate()}/${d.getMonth() + 1} · ${base}`;
}

/** Simple animated typing indicator (3 dots) — no reanimated needed. */
function TypingDots({ color }: { color: string }) {
  const [visible, setVisible] = useState(1);
  useEffect(() => {
    const t = setInterval(() => setVisible((v) => (v % 3) + 1), 450);
    return () => clearInterval(t);
  }, []);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 6 }}>
      {[1, 2, 3].map((i) => (
        <View
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: color,
            opacity: visible >= i ? 0.9 : 0.25,
          }}
        />
      ))}
    </View>
  );
}

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ uri: string; base64: string; width: number; height: number } | null>(null);
  const [modelKey, setModelKey] = useState<string>("mistral/mistral-small-latest");

  // --- Per-chat model: conversation's own modelKey overrides the global default ---
  const effectiveModelKey = conversation?.modelKey?.trim() ? conversation.modelKey : modelKey;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [keyAvailability, setKeyAvailability] = useState<Record<string, boolean>>({});
  const { colorScheme, setColorScheme } = useThemeContext();
  const [cloudSyncOn, setCloudSyncOn] = useState(false);
  const [scrolledUp, setScrolledUp] = useState(false);
  const [longPressMsg, setLongPressMsg] = useState<{ id: string; index: number } | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editMsgText, setEditMsgText] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Record<string, "like" | "dislike" | null>>({});
  const [promptText, setPromptText] = useState<string[]>([]);
  const [replyTarget, setReplyTarget] = useState<DisplayMessage | null>(null);
  const [continueVisible, setContinueVisible] = useState(false);
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatSearchText, setChatSearchText] = useState("");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [templatesVisible, setTemplatesVisible] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [modesVisible, setModesVisible] = useState(false);
  const [translatorVisible, setTranslatorVisible] = useState(false);
  const [pendingPdf, setPendingPdf] = useState<{ name: string; text: string } | null>(null);
  const [genStatus, setGenStatus] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [canvasText, setCanvasText] = useState("");
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [reminderDefaultText, setReminderDefaultText] = useState("");
  const [welcomePrompts, setWelcomePrompts] = useState(() => pickWelcomePrompts());

  // Rotating welcome prompts: refresh the empty-screen suggestions every 12s while idle.
  useEffect(() => {
    const t = setInterval(() => {
      setWelcomePrompts(pickWelcomePrompts());
    }, 12000);
    return () => clearInterval(t);
  }, []);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);


  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<FlatList<DisplayMessage>>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sendMessageRef = useRef<(() => void) | null>(null);
  const { isListening, dictError, toggleDictation, stopDictation } = useVoiceDictation();
  const router = useRouter();
  const { fontSize } = useFontSize();

  // When dictation yields a FINAL transcript, send it directly (hold-to-talk voice message).
  const commitFinalTranscript = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setModeNotice(null);
    setInput(trimmed);
    // Fire send on the next tick so input state is committed first.
    setTimeout(() => sendMessageRef.current?.(), 60);
  }, []);

  // Stop dictation whenever a message is being sent.
  useEffect(() => {
    if (sending) stopDictation();
  }, [sending, stopDictation]);

  // --- Chat mode apply ---
  const handleApplyMode = useCallback(
    async (mode: ChatMode, targetLanguage?: string) => {
      const conv = conversation;
      if (!conv) return;
      const { setConversationMode } = await import("@/lib/storage");
      await setConversationMode(conv.id, mode, targetLanguage);
      const { getConversation } = await import("@/lib/storage");
      const fresh = await getConversation(conv.id);
      if (fresh) setConversation(fresh);
    },
    [conversation],
  );

  // --- Chat template apply ---
  const handleApplyTemplate = useCallback(
    async (templateId: string | null) => {
      const conv = conversation;
      if (!conv) return;
      const { setConversationTemplate } = await import("@/lib/storage");
      await setConversationTemplate(conv.id, templateId);
      const fresh = await (async () => {
        const { getConversation } = await import("@/lib/storage");
        return getConversation(conv.id);
      })();
      if (fresh) setConversation(fresh);
    },
    [conversation],
  );

  const openConversation = useCallback((conv: Conversation, fallbackModel?: string) => {
    setConversation(conv);
    setMessages(
      conv.messages.map((m) => ({
        id: m.id,
        role: m.role,
        text: m.text,
        error: m.error,
        imageUri: m.imageUri,
      })),
    );
    if (conv.messages.length > 0) setModelKey(conv.modelKey || fallbackModel || modelKey);
    else if (fallbackModel) setModelKey(fallbackModel);
    setReplyTarget(null);
    setContinueVisible(false);
  }, []);

  const startNew = useCallback(async (convs: Conversation[], model: string) => {
    const conv = await createConversation(model);
    openConversation(conv, model);
  }, [openConversation]);

  // Starter prompt tap: open the latest chat (or create a new one), then send the prompt.
  const sendStarterPrompt = useCallback(
    async (prompt: string) => {
      haptic();
      const convs = await getConversations();
      if (convs.length > 0) {
        openConversation(convs[0]);
      } else {
        await startNew(convs, modelKey);
      }
      setInput(prompt);
      // Wait a tick so conversation + input state settle, then fire send.
      setTimeout(() => {
        sendMessageRef.current?.();
      }, 80);
    },
    [openConversation, startNew, modelKey],
  );
  // Load settings + (non-expired) latest conversation on mount; silently check for remote updates
  useEffect(() => {
    (async () => {
      // Fire-and-forget: pull latest remote config if a new version is hosted.
      checkForUpdates().catch(() => {});
      const syncEnabled = await getCloudSyncEnabled();
      setCloudSyncOn(syncEnabled);
      if (syncEnabled) requestSync();
      const { getEffectiveDefaultModelKey } = await import("@/lib/providers");
      const settings = await getSettings();
      const effectiveDefault = await getEffectiveDefaultModelKey();
      const model = settings.modelKey || effectiveDefault;
      setModelKey(model);
      const convs = await getConversations();
      if (convs.length > 0 && !isExpired(convs[0])) {
        openConversation(convs[0], model);
      } else {
        await startNew(convs, model);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Launcher shortcut / deep link: manusapp://new or ://ask -> open a fresh chat
  useEffect(() => {
    (async () => {
      try {
        const Linking = await import("expo-linking");
        const url = await Linking.default.getInitialURL();
        await handleShortcutUrl(url);
      } catch {
        // web or unavailable — ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh key-availability map when settings/history panels open or after a key save.
  // Built-in (hidden) keys also count as available — the app works without user keys.
  const refreshKeyAvailability = useCallback(async () => {
    try {
      const { getAllKeys } = await import("@/lib/storage");
      const { hasUsableKey } = await import("@/lib/builtin-keys");
      const keys = await getAllKeys();
      const map: Record<string, boolean> = {};
      for (const k of Object.keys(keys)) {
        map[k] = await hasUsableKey(k);
      }
      setKeyAvailability(map);
    } catch {
      // Non-fatal: picker simply shows no badges
    }
  }, []);
  useEffect(() => {
    if (!settingsOpen && !historyOpen) return;
    refreshKeyAvailability();
  }, [settingsOpen, historyOpen, refreshKeyAvailability]);

  const haptic = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const [modeNotice, setModeNotice] = useState<string | null>(null);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [debateOpen, setDebateOpen] = useState(false);
  const [debateNotice, setDebateNotice] = useState<string | null>(null);
  const [kbOpen, setKbOpen] = useState(false);

  // --- Slash command dispatcher (registered once) ---
  const handleSlash = useCallback(
    async (text: string): Promise<boolean> => {
      const t = text.trim();
      const [cmd, ...rest] = t.slice(1).split(/\s+/);
      const arg = rest.join(" ");
      switch (cmd) {
        case "img":
          if (arg) {
            setInput("");
            setSending(true);
            setBusyModel(effectiveModelKey);
            haptic();
            try {
              setGenStatus("Generating image…");
              const conv = conversation;
              if (!conv) return true;
              await addMessage(conv.id, { role: "user", text: arg });
              await addMessage(conv.id, { role: "assistant", text: "" });
              setMessages((prev) => [
                ...prev,
                { id: `u-${Date.now()}`, role: "user", text: arg, createdAt: Date.now() },
                { id: `a-${Date.now()}`, role: "assistant", text: "", createdAt: Date.now(), genProgress: "Generating image…" },
              ]);
              const result = await generateImage({ modelKey: effectiveModelKey, prompt: arg });
              await addMessage(conv.id, { role: "assistant", text: `__GEN_MEDIA__image__${result.base64 || ""}__END__` });
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { ...copy[copy.length - 1], text: `__GEN_MEDIA__image__${result.base64 || ""}__END__` };
                return copy;
              });
            } catch (e) {
              const err = e instanceof Error ? e.message : String(e);
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { id: `a-${Date.now()}`, role: "assistant", text: err, error: true };
                return copy;
              });
            } finally {
              setGenStatus(null);
              setSending(false);
              setBusyModel(null);
            }
          } else {
            setInput("/img ");
          }
          return true;
        case "pdf": {
          pickPdf();
          return true;
        }
        case "voice": {
          setModeNotice("Hold the mic button to record and send a voice message");
          return true;
        }
        case "search": {
          const { getWebSearchEnabled, setWebSearchEnabled } = await import("@/lib/storage");
          const cur = await getWebSearchEnabled();
          await setWebSearchEnabled(!cur);
          setModeNotice(cur ? "Web search turned off" : "Web search turned on");
          return true;
        }
        case "resume": {
          setResumeOpen(true);
          return true;
        }
        case "canvas": {
          setCanvasOpen(true);
          return true;
        }
        case "debate": {
          setDebateOpen(true);
          return true;
        }
        case "kb": {
          setKbOpen(true);
          return true;
        }
        default:
          if (cmd.startsWith("mode-")) {
            const mode = cmd.slice(5) as ChatMode;
            if (MODE_LABELS[mode]) {
              await handleApplyMode(mode);
              setModeNotice(`Mode set to ${MODE_LABELS[mode]}`);
              return true;
            }
          }
          return false;
      }
    },
    [effectiveModelKey, conversation, haptic, handleApplyMode],
  );

  useEffect(() => {
    setSlashHandler(handleSlash);
    return () => {
      setSlashHandler(() => false);
    };
  }, [handleSlash]);

  // --- Per-chat model setter (saved on the conversation itself) ---
  const setConversationModelKey = useCallback(async (convId: string, key: string) => {
    haptic();
    const convs = await getConversations();
    const conv = convs.find((c) => c.id === convId);
    if (!conv) return;
    const updated = { ...conv, modelKey: key, updatedAt: Date.now() };
    await (async () => {
      const { saveConversation } = await import("@/lib/storage");
      await saveConversation(updated);
    })();
    setConversation((cur) => (cur?.id === convId ? updated : cur));
  }, [haptic]);

  // --- PDF attachment ---
  const pickPdf = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const asset = result.assets[0];
      haptic();
      setGenStatus("Reading PDF…");
      const text = await extractPdfText({ uri: asset.uri });
      setGenStatus(null);
      if (!text || text.trim().length < 5) {
        setPendingPdf({ name: asset.name ?? "document.pdf", text: "(no readable text found — the PDF may be scanned images)" });
      } else {
        setPendingPdf({ name: asset.name ?? "document.pdf", text });
      }
    } catch (e) {
      setGenStatus(null);
      if (!(e as { code?: string }).code) {
        // user cancelled
      }
    }
  }, [haptic]);

  const pickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.8,
      selectionLimit: 1,
    });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    haptic();
    const { base64, width, height } = await imageToBase64(asset.uri);
    setPendingImage({ uri: asset.uri, base64, width, height });
  }, [haptic]);

  const handleSelectModel = useCallback(async (key: string) => {
    setPickerOpen(false);
    const model = getModel(key);
    if (!model) return;
    if (conversation) {
      // Per-chat model: saved on the conversation itself
      await setConversationModelKey(conversation.id, key);
    } else {
      setModelKey(key);
      const { setSettings } = await import("@/lib/storage");
      await setSettings({ modelKey: key });
    }
  }, [conversation, setConversationModelKey]);

  const handleOpenConversation = useCallback(
    async (id: string) => {
      setHistoryOpen(false);
      const convs = await getConversations();
      const conv = convs.find((x) => x.id === id);
      if (conv) openConversation(conv);
    },
    [openConversation],
  );

  const handleNewChat = useCallback(async () => {
    setHistoryOpen(false);
    setChatSearchOpen(false);
    setSuggestions([]);
    const convs = await getConversations();
    await startNew(convs, modelKey);
  }, [modelKey, startNew]);

  const handleShortcutUrl = useCallback(
    async (url: string | null) => {
      if (!url || (!url.includes("/new") && !url.includes("/ask"))) return;
      // Deep link for launcher shortcut: jump straight to a new chat.
      await handleNewChat();
    },
    [handleNewChat],
  );

  // --- Stop generation ---
  const stopReply = useCallback(() => {
    haptic();
    abortRef.current?.abort();
  }, [haptic]);

  // --- Like / dislike reactions ---
  const setReactionLocal = useCallback(async (msgId: string, r: "like" | "dislike" | null) => {
    if (!conversation) return;
    setReactions((prev) => {
      const cur = prev[msgId] ?? null;
      const next = cur === r ? null : r;
      const copy = { ...prev };
      if (next) copy[msgId] = next;
      else delete copy[msgId];
      return copy;
    });
    await (async () => {
      const { setReaction, getReactions } = await import("@/lib/storage");
      const cur = reactions[msgId] ?? null;
      const next = cur === r ? null : r;
      await setReaction(conversation.id, msgId, next);
      const all = await getReactions();
      setReactions(all[conversation.id] ?? {});
    })();
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [conversation, reactions, haptic]);

  // Load reactions whenever the conversation changes
  useEffect(() => {
    if (!conversation) return;
    (async () => {
      const { getReactions } = await import("@/lib/storage");
      const all = await getReactions();
      setReactions(all[conversation.id] ?? {});
    })();
  }, [conversation?.id]);

  // --- Reply (quote) a message ---
  const startReply = useCallback((msg: DisplayMessage) => {
    setLongPressMsg(null);
    setReplyTarget(msg);
    haptic();
  }, [haptic]);

  // Record lightweight usage counters after each completed AI response
  const recordUsageLocal = useCallback(async (modelKeyLocal: string, chars: number) => {
    if (chars <= 0) return;
    try {
      const { recordUsage } = await import("@/lib/storage");
      await recordUsage(modelKeyLocal, chars);
    } catch {
      // ignore
    }
  }, []);

  // Follow-up suggestions: 3 short chips after an assistant reply finishes
  const fetchSuggestions = useCallback(async (convId: string, model: string, historyText: string) => {
    try {
      const { getApiKey: getApiKeyFn } = await import("@/lib/storage");
      const modelDef = getModel(model);
      if (!modelDef) return;
      const apiKey = (await getApiKeyFn("gemini")) || (await getApiKeyFn(modelDef.providerKey));
      if (!apiKey || apiKey.length < 10) return;
      const base = await getBase(modelDef.providerKey);
      const res = await fetch(base + "/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          ...(modelDef.providerKey === "openrouter" ? { "HTTP-Referer": "https://manus.im", "X-Title": "AI Chat" } : {}),
        },
        body: JSON.stringify({
          model: modelDef.id.slice(modelDef.providerKey.length + 1),
          messages: [
            { role: "system", content: "You suggest follow-up questions. Reply with exactly 3 short numbered lines (e.g. 1. ...) each under 12 words." },
            { role: "user", content: historyText.slice(-3000) },
          ],
          max_tokens: 120,
          temperature: 0.3,
        }),
      });
      if (!res.ok) return;
      const json = await res.json();
      const content: string = json.choices?.[0]?.message?.content ?? "";
      const lines = content
        .split(/\n/)
        .map((l: string) => l.replace(/^\s*\d+[\.\)\-\s]+/, "").trim())
        .filter((l: string) => l.length > 3 && l.length < 120)
        .slice(0, 3);
      if (lines.length >= 2) setSuggestions(lines);
    } catch {
      // no suggestions — that's fine
    }
  }, [getModel]);

  // Shared handler: record usage + refresh follow-up suggestions after a stream completes
  const onStreamDone = useCallback(async (conv: Conversation) => {
    const lastReply = [...conv.messages].reverse().find((m) => m.role === "assistant" && m.text && !m.error);
    if (lastReply) {
      recordUsageLocal(effectiveModelKey, lastReply.text.length);
      fetchSuggestions(conv.id, effectiveModelKey, conv.messages.map((m) => m.text).join("\n"));
    }
  }, [effectiveModelKey, recordUsageLocal, fetchSuggestions]);

  // --- Continue generating ---
  const continueReply = useCallback(async () => {
    const conv = conversation;
    if (!conv || sending || conv.messages.length === 0) return;
    const msgs = conv.messages;
    const last = msgs[msgs.length - 1];
    if (last.role !== "assistant" || !last.text.trim()) return;
    haptic();
    setContinueVisible(false);
    setBusyModel(effectiveModelKey);

    await addMessage(conv.id, { role: "user", text: "Continue exactly from where you stopped." });
    await addMessage(conv.id, { role: "assistant", text: "" });
    const display: DisplayMessage[] = msgs.map((m) => ({ id: m.id, role: m.role, text: m.text, error: m.error, imageUri: m.imageUri, createdAt: m.createdAt }));
    display.push({ id: `a-${Date.now()}`, role: "assistant", text: "", createdAt: Date.now() });
    setMessages(display);
    setSending(true);

    const history = [
      { role: "system" as const, text: await getConversationSystemPrompt(conversation?.templateId, conversation?.chatMode, conversation?.translateTarget) },
      ...msgs.map((m) => ({ role: m.role, text: m.text })),
      { role: "user" as const, text: "Continue exactly from where you stopped." },
    ];
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      await streamChat({ modelKey: effectiveModelKey, messages: history, onToken: (token) => {
        setMessages((prev) => {
          const copy = [...prev];
          const lastm = copy[copy.length - 1];
          if (lastm && lastm.role === "assistant") copy[copy.length - 1] = { ...lastm, text: lastm.text + token };
          return copy;
        });
        appendAssistantText(conv.id, token);
      }, signal: abort.signal });
    } catch (e) {
      const errorText = e instanceof Error ? e.message : String(e);
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { id: `a-${Date.now()}`, role: "assistant", text: errorText, error: true };
        return copy;
      });
      await markAssistantError(conv.id, errorText);
    } finally {
      setSending(false);
      abortRef.current = null;
      setBusyModel(null);
      if (cloudSyncOn) requestSync();
    }
    const fresh = await getConversation(conv.id);
    if (fresh) await onStreamDone(fresh);
  }, [conversation, sending, modelKey, effectiveModelKey, haptic, cloudSyncOn, onStreamDone]);

  // --- Debate mode: two models alternate streaming ---
  const handleStartDebate = useCallback(
    async (model2Key: string, rounds: number) => {
      const conv = conversation;
      if (!conv || sending || !conv.messages.length) return;
      haptic();
      abortRef.current?.abort();
      const abort = new AbortController();
      abortRef.current = abort;
      setSending(true);
      setDebateNotice(`Debate starting…`);
      try {
        for (let r = 1; r <= rounds; r++) {
          if (abort.signal.aborted) return;
          // Primary model round
          setBusyModel(effectiveModelKey);
          setMessages((prev) => [...prev, { id: `deb-${Date.now()}-${r}-1`, role: "assistant", text: "", createdAt: Date.now(), genProgress: `Debate round ${r}/${rounds}…` }]);
          const p1 = await streamChat({
            modelKey: effectiveModelKey,
            messages: [
              { role: "system", text: `You are in a structured debate. Give a concise, substantive argument (3-6 sentences). No pleasantries.` },
              ...messages
                .filter((m) => m.role !== "assistant" || !m.text.startsWith("__DEBATE2__"))
                .map((m) => ({ role: m.role, text: m.text })),
            ],
            onToken: (token) => {
              setMessages((prev) => {
                const copy = [...prev];
                const lastm = copy[copy.length - 1];
                if (lastm && lastm.role === "assistant" && lastm.genProgress) {
                  copy[copy.length - 1] = { ...lastm, genProgress: undefined, text: token };
                } else if (lastm && lastm.role === "assistant") {
                  copy[copy.length - 1] = { ...lastm, text: lastm.text + token };
                }
                return copy;
              });
            },
            signal: abort.signal,
          });
          await appendAssistantText(conv.id, p1);
          if (r < rounds && !abort.signal.aborted) {
            // Opponent model round
            setBusyModel(model2Key);
            const oppName = await getDebateName(model2Key);
            setMessages((prev) => [...prev, { id: `deb-${Date.now()}-${r}-2`, role: "assistant", text: `__DEBATE2__${oppName}\n`, createdAt: Date.now(), genProgress: `Opponent round ${r}/${rounds}…` }]);
            const p2 = await streamChat({
              modelKey: model2Key,
              messages: [
                { role: "system", text: `You are the opposing debater. Critique and counter the arguments above with a concise, substantive counter-argument (3-6 sentences).` },
                ...messages
                  .filter((m) => m.role !== "assistant" || !m.text.startsWith("__DEBATE2__"))
                  .map((m) => ({ role: m.role, text: m.text })),
                { role: "assistant", text: p1 },
              ],
              onToken: (token) => {
                setMessages((prev) => {
                  const copy = [...prev];
                  const lastm = copy[copy.length - 1];
                  if (lastm && lastm.role === "assistant") {
                    copy[copy.length - 1] = { ...lastm, genProgress: undefined, text: lastm.text + token };
                  }
                  return copy;
                });
              },
              signal: abort.signal,
            });
            await appendAssistantText(conv.id, `__DEBATE2__${oppName}\n${p2}`);
          }
          setBusyModel(null);
        }
        setDebateNotice("Debate finished");
        setTimeout(() => setDebateNotice(null), 3000);
      } catch (e) {
        const errorText = e instanceof Error ? e.message : String(e);
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { id: `a-${Date.now()}`, role: "assistant", text: errorText, error: true };
          return copy;
        });
      } finally {
        abortRef.current = null;
        setSending(false);
        setBusyModel(null);
        if (cloudSyncOn) requestSync();
        const fresh = await getConversation(conv.id);
        if (fresh) await onStreamDone(fresh);
      }
    },
    [conversation, sending, messages, effectiveModelKey, haptic, cloudSyncOn, onStreamDone, appendAssistantText],
  );

  // --- Chat export as Markdown ---
  const handleExportMarkdown = useCallback(async () => {
    const conv = conversation;
    if (!conv || conv.messages.length === 0) return;
    const date = new Date(conv.createdAt).toLocaleString();
    const lines = [`# ${conv.title}`, `> ${date}`, ""];
    for (const m of conv.messages) {
      lines.push(`### ${m.role === "user" ? "You" : "AI"}`);
      lines.push(m.text.trim() || "_(no text)_");
      lines.push("");
    }
    try {
      if (Platform.OS === "web") {
        const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${conv.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.md`;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }
      await Share.share({ message: lines.join("\n").trim() });
    } catch {
      // share cancelled or unavailable
    }
  }, [conversation]);

  // --- Export chat as a styled HTML file ---
  const handleExportHtml = useCallback(async () => {
    const conv = conversation;
    if (!conv || conv.messages.length === 0) return;
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const date = new Date(conv.createdAt).toLocaleString();
    const bubbles = conv.messages
      .map(
        (m) =>
          `<div class="msg ${m.role}"><div class="role">${m.role === "user" ? "You" : "AI"}</div><p>${esc(m.text.trim() || "_(no text)_")
            .split("\n")
            .map((l) => esc(l))
            .join("<br/>")}</p></div>`,
      )
      .join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(conv.title)}</title>
<style>body{margin:0;background:#151718;color:#ECEDEE;font-family:sans-serif;padding:16px}
.msg{margin:10px 0;max-width:80%;padding:12px 16px;border-radius:18px;line-height:1.5}
.msg.user{margin-left:auto;background:#2f3238;text-align:right}
.msg.assistant{background:transparent}.role{font-size:11px;font-weight:700;opacity:.6;margin-bottom:4px}
p{margin:4px 0}</style></head><body>
<h2>${esc(conv.title)}</h2><small style="opacity:.5">${esc(date)}</small>${bubbles}</body></html>`;
    try {
      if (Platform.OS === "web") {
        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${conv.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.html`;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }
      await Share.share({ message: html });
    } catch {
      // share cancelled or unavailable
    }
  }, [conversation]);

  // --- Export chat as a PDF file ---
  const handleExportPdf = useCallback(async () => {
    const conv = conversation;
    if (!conv || conv.messages.length === 0) return;
    const esc = (s: string) =>
      s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    const date = new Date(conv.createdAt).toLocaleString();
    const bubbles = conv.messages
      .map(
        (m) =>
          `<div class="msg ${m.role}"><div class="role">${m.role === "user" ? "You" : "AI"}</div><p>${esc(m.text.trim() || "_(no text)_")
            .split("\n")
            .map((l) => esc(l))
            .join("<br/>")}</p></div>`,
      )
      .join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(conv.title)}</title>
<style>body{margin:0;background:#ffffff;color:#11181C;font-family:sans-serif;padding:20px}
.msg{margin:10px 0;max-width:80%;padding:12px 16px;border-radius:18px;line-height:1.5}
.msg.user{margin-left:auto;background:#f5f5f5;text-align:right}
.msg.assistant{background:#fafafa}.role{font-size:11px;font-weight:700;opacity:.6;margin-bottom:4px}
h2{margin:0 0 2px}.p{margin:4px 0}</style></head><body>
<h2>${esc(conv.title)}</h2><small style="opacity:.5">${esc(date)}</small>${bubbles}</body></html>`;
    try {
      if (Platform.OS === "web") {
        // Web: build an HTML file for download (no native print on web preview)
        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${conv.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.html`;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Export chat as PDF" });
    } catch {
      // share cancelled or unavailable
    }
  }, [conversation]);

  // --- In-chat search ---
  const chatMatches = useMemo(() => {
    const q = chatSearchText.trim().toLowerCase();
    if (!q || !conversation) return [] as { id: string; index: number; snippet: string }[];
    const out: { id: string; index: number; snippet: string }[] = [];
    conversation.messages.forEach((m, i) => {
      const low = m.text.toLowerCase();
      const idx = low.indexOf(q);
      if (idx !== -1) {
        const start = Math.max(0, idx - 40);
        const end = Math.min(m.text.length, idx + 60);
        out.push({ id: m.id, index: i, snippet: (start > 0 ? "…" : "") + m.text.slice(start, end) + (end < m.text.length ? "…" : "") });
      }
    });
    return out;
  }, [chatSearchText, conversation]);

  const jumpToMatch = useCallback((matchId: string) => {
    const idx = messages.findIndex((m) => m.id === matchId);
    setChatSearchOpen(false);
    if (idx === -1) return;
    setHighlightedId(matchId);
    setTimeout(() => listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.4 }), 60);
    setTimeout(() => setHighlightedId(null), 2500);
  }, [messages]);

  // --- Saved prompts bar ---
  useEffect(() => {
    if (!chatSearchOpen && !settingsOpen) {
      (async () => {
        const { getSavedPrompts } = await import("@/lib/storage");
        const prompts = await getSavedPrompts();
        setPromptText(prompts.map((p) => p.text));
      })();
    }
  }, [chatSearchOpen, settingsOpen]);

  const useSavedPrompt = useCallback(async (text: string) => {
    setInput(text);
    haptic();
    setTimeout(() => sendMessageRef.current?.(), 60);
  }, [haptic]);

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      await deleteConversation(id);
      if (id === conversation?.id) {
        const remaining = await getConversations();
        if (remaining.length > 0) {
          openConversation(remaining[0]);
        } else {
          await startNew(remaining, modelKey);
        }
      }
      if (cloudSyncOn) requestSync();
    },
    [conversation, modelKey, openConversation, startNew, cloudSyncOn],
  );

  const handleClearAll = useCallback(async () => {
    await clearConversations();
    setHistoryOpen(false);
    const remaining = await getConversations();
    if (remaining.length > 0) {
      openConversation(remaining[0]);
    } else {
      await startNew(remaining, modelKey);
    }
    if (cloudSyncOn) requestSync();
  }, [modelKey, openConversation, startNew, cloudSyncOn]);

  // Offline draft queue (auto-flushed when the network returns)
  const isConnected = useConnectivity();

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if ((!text && !pendingImage) || sending || !conversation) return;

    // --- Offline draft: network is down — queue the message and auto-send on reconnect ---
    if (!isConnected) {
      const queuedId = await enqueueOfflineMessage(conversation.id, text, {
        hasImage: !!pendingImage,
        pdfName: pendingPdf?.name,
        modelKey: effectiveModelKey,
      });
      setMessages((prev) => [
        ...prev,
        {
          id: queuedId,
          role: "user",
          text: text || (pendingImage ? "(image)" : "Message"),
          createdAt: Date.now(),
          offlineDraft: true,
        },
      ]);
      setModeNotice("No internet — message saved. It will send automatically when you're back online.");
      setPendingImage(null);
      setPendingPdf(null);
      setInput("");
      try {
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch { /* web */ }
      return;
    }
    setBusyModel(effectiveModelKey);

    // --- Slash commands: /img /pdf /voice /search /resume /canvas /debate /kb /mode-<x> ---
    const cmdHandled = await dispatchSlashCommand(text);
    if (cmdHandled) {
      setBusyModel(null);
      setSending(false);
      return;
    }
    setSending(true);
    haptic();

    // Quote the replied message at the top of the user text (ChatGPT-style "reply")
    let userText = text;
    if (replyTarget && replyTarget.text.trim()) {
      userText = `${text ? text + "\n\n" : ""}> Re: ${replyTarget.text.trim().slice(0, 200)}${replyTarget.text.trim().length > 200 ? "…" : ""}`;
    } else if (!text && pendingImage) {
      userText = "Describe this image";
    }
    setReplyTarget(null);
    const image: ImageAttachment | null = pendingImage
      ? { uri: pendingImage.uri, base64: pendingImage.base64, width: pendingImage.width, height: pendingImage.height }
      : null;

    setPendingImage(null);
    const pdfAttachment = pendingPdf;
    setPendingPdf(null);
    setInput("");

    // Persist user message
    await addMessage(conversation.id, {
      role: "user",
      text: userText,
      imageUri: image?.uri,
    });
    // Persist placeholder assistant message
    await addMessage(conversation.id, { role: "assistant", text: "" });
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user", text: userText, imageUri: image?.uri, createdAt: Date.now() },
      { id: `a-${Date.now()}`, role: "assistant", text: "", createdAt: Date.now() },
    ]);

    // Keep the conversation state in sync for follow-up operations (re-fetch persisted messages)
    const freshConv = await getConversation(conversation.id);
    if (freshConv) setConversation(freshConv);

    setSuggestions([]);

    // --- NVIDIA generation models: image/audio instead of chat ---
    if (isNvidiaImageModel(effectiveModelKey)) {
      try {
        setGenStatus("Generating image…");
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { id: copy[copy.length - 1].id, role: "assistant", text: "", createdAt: copy[copy.length - 1].createdAt, genProgress: "Generating image…" };
          return copy;
        });
        const abort = new AbortController();
        abortRef.current = abort;
        const result = await generateImage({
          modelKey: effectiveModelKey,
          prompt: userText,
          onProgress: (status) => {
            setMessages((prev) => {
              const copy = [...prev];
              copy[copy.length - 1] = { ...copy[copy.length - 1], genProgress: status };
              return copy;
            });
          },
          signal: abort.signal,
        });
        const mediaBase64 = result.base64 || "";
        await addMessage(conversation.id, { role: "assistant", text: `__GEN_MEDIA__image__${mediaBase64}__END__` });
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { ...copy[copy.length - 1], text: `__GEN_MEDIA__image__${mediaBase64}__END__` };
          return copy;
        });
      } catch (e) {
        const errorText = e instanceof Error ? e.message : String(e);
        await addMessage(conversation.id, { role: "assistant", text: errorText, error: true });
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { id: `a-${Date.now()}`, role: "assistant", text: errorText, error: true };
          return copy;
        });
      } finally {
        setGenStatus(null);
        setSending(false);
        abortRef.current = null;
        setBusyModel(null);
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last && last.role === "assistant" && !last.error && !last.source) {
            copy[copy.length - 1] = { ...last, source: getModelSourceLabel(effectiveModelKey) };
          }
          return copy;
        });
        if (cloudSyncOn) requestSync();
      }
      return;
    }
    if (isNvidiaAudioModel(effectiveModelKey)) {
      try {
        setGenStatus("Generating audio…");
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { id: copy[copy.length - 1].id, role: "assistant", text: "", createdAt: copy[copy.length - 1].createdAt, genProgress: "Generating audio…" };
          return copy;
        });
        const abort = new AbortController();
        abortRef.current = abort;
        const result = await generateAudio({
          modelKey: effectiveModelKey,
          prompt: userText,
          onProgress: (status) => {
            setMessages((prev) => {
              const copy = [...prev];
              copy[copy.length - 1] = { ...copy[copy.length - 1], genProgress: status };
              return copy;
            });
          },
          signal: abort.signal,
        });
        await addMessage(conversation.id, { role: "assistant", text: `__GEN_MEDIA__audio__${result.base64 ?? ""}__END__` });
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { ...copy[copy.length - 1], text: `__GEN_MEDIA__audio__${result.base64 ?? ""}__END__` };
          return copy;
        });
      } catch (e) {
        const errorText = e instanceof Error ? e.message : String(e);
        await addMessage(conversation.id, { role: "assistant", text: errorText, error: true });
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { id: `a-${Date.now()}`, role: "assistant", text: errorText, error: true };
          return copy;
        });
      } finally {
        setGenStatus(null);
        setSending(false);
        abortRef.current = null;
        setBusyModel(null);
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last && last.role === "assistant" && !last.error && !last.source) {
            copy[copy.length - 1] = { ...last, source: getModelSourceLabel(effectiveModelKey) };
          }
          return copy;
        });
        if (cloudSyncOn) requestSync();
      }
      return;
    }

    // --- Normal / mode-driven chat ---
    // Append PDF text as context at the end of the user message for chat models
    const finalUserText = pdfAttachment ? `${userText ? userText + "\n\n" : ""}--- Attached PDF: ${pdfAttachment.name} ---\n${pdfAttachment.text}` : userText;
    if (pdfAttachment) {
      await addMessage(conversation.id, { role: "user", text: finalUserText });
    }
    // Full history incl. user message for the API
    const history = [
      { role: "system" as const, text: await getConversationSystemPrompt(conversation?.templateId, conversation?.chatMode, conversation?.translateTarget) },
      ...conversation.messages.map((m) => ({ role: m.role, text: m.text })),
      { role: "user" as const, text: finalUserText },
    ];

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      await streamChat({
        modelKey: effectiveModelKey,
        messages: history,
        image,
        onToken: (token) => {
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last && last.role === "assistant") {
              copy[copy.length - 1] = { ...last, text: last.text + token };
            }
            return copy;
          });
          appendAssistantText(conversation.id, token);
        },
        signal: abort.signal,
      });
    } catch (e) {
      const errorText = e instanceof Error ? e.message : String(e);
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { id: `a-${Date.now()}`, role: "assistant", text: errorText, error: true };
        return copy;
      });
      await markAssistantError(conversation.id, errorText);
    } finally {
      setSending(false);
      abortRef.current = null;
      setBusyModel(null);
      // Per-message source badge: stamp the completed assistant reply with model + provider
      setMessages((prev) => {
        const copy = [...prev];
        for (let i = copy.length - 1; i >= 0; i--) {
          const m = copy[i];
          if (m.role === "assistant" && !m.error && !m.source && m.text) {
            copy[i] = { ...m, source: getModelSourceLabel(effectiveModelKey) };
            break; // stamp the most recent completed assistant message only
          }
        }
        return copy;
      });
      if (cloudSyncOn) requestSync();
    }
    // Record usage stats (assistant chars) and refresh follow-up suggestions
    const lastAssistant = (await getConversation(conversation.id))?.messages.filter((m) => m.role === "assistant");
    const lastReply = lastAssistant?.[lastAssistant.length - 1];
    if (lastReply && !lastReply.error && lastReply.text) {
      recordUsageLocal(effectiveModelKey, lastReply.text.length);
      fetchSuggestions(conversation.id, effectiveModelKey, [...conversation.messages.map((m) => m.text), finalUserText].join("\n"));
    }
  }, [input, pendingImage, pendingPdf, sending, conversation, modelKey, effectiveModelKey, isConnected, haptic, cloudSyncOn, recordUsageLocal, fetchSuggestions]);

  // Refresh the custom system prompt cache after each send so Settings changes take effect.
  useEffect(() => {
    if (!sending) reloadSystemPrompt().catch(() => {});
  }, [sending]);

  // Keep the starter-prompt ref pointed at the latest sendMessage.
  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  const handleShareChat = useCallback(async () => {
    setLongPressMsg(null);
    const conv = conversation;
    if (!conv || conv.messages.length === 0) return;
    const date = new Date(conv.createdAt).toLocaleString();
    const lines = [`Chat: ${conv.title}`, `Date: ${date}`, "---"];
    for (const m of conv.messages) {
      lines.push(`${m.role === "user" ? "You" : "AI"}: ${m.text}`);
      lines.push("");
    }
    try {
      await Share.share({ message: lines.join("\n").trim() });
    } catch {
      // share cancelled or unavailable
    }
  }, [conversation]);

  // --- Message actions (copy / regenerate / delete via long-press) ---
  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const startLongPress = useCallback((msgId: string, index: number) => {
    cancelLongPress();
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    longPressTimer.current = setTimeout(() => {
      setLongPressMsg({ id: msgId, index });
      longPressTimer.current = null;
    }, 550);
  }, [cancelLongPress]);

  // --- TTS read-aloud for assistant messages ---
  const toggleSpeak = useCallback((item: DisplayMessage) => {
    if (speakingId === item.id) {
      Speech.stop();
      setSpeakingId(null);
      return;
    }
    if (!item.text.trim()) return;
    if (speakingId) Speech.stop();
    Speech.speak(item.text, {
      onDone: () => setSpeakingId((cur) => (cur === item.id ? null : cur)),
      onError: () => setSpeakingId(null),
    });
    setSpeakingId(item.id);
    haptic();
  }, [speakingId, haptic]);

  // Stop speaking when navigating away / sending / unmounting
  useEffect(() => {
    if (sending || !conversation) {
      Speech.stop();
      setSpeakingId(null);
    }
  }, [sending, conversation?.id]);

  // --- Voice reply: auto read the last assistant message aloud when it finishes ---
  const [autoReadAloud, setAutoReadAloud] = useState(false);
  useEffect(() => {
    if (!conversation) return;
    (async () => {
      const { getAutoReadAloud } = await import("@/lib/storage");
      setAutoReadAloud(await getAutoReadAloud());
    })();
  }, [conversation?.id, settingsOpen]);

  useEffect(() => {
    if (!autoReadAloud || sending || !conversation || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant" || last.error || !last.text.trim()) return;
    // The assistant message just finished generating — read it aloud automatically.
    Speech.speak(last.text, {
      onDone: () => setSpeakingId((cur) => (cur === last.id ? null : cur)),
      onError: () => setSpeakingId(null),
    });
    setSpeakingId(last.id);
  }, [sending, autoReadAloud, conversation?.id, messages.length, messages[messages.length - 1]?.id, messages[messages.length - 1]?.role, messages[messages.length - 1]?.error]);

  const handleToggleAutoReadAloud = useCallback(async (enabled: boolean) => {
    haptic();
    setAutoReadAloud(enabled);
    await (async () => {
      const { setAutoReadAloud: save } = await import("@/lib/storage");
      await save(enabled);
    })();
  }, [haptic]);

  const handleCopyMessage = useCallback(async (item: DisplayMessage) => {
    cancelLongPress();
    await Clipboard.setStringAsync(item.text || "");
    setCopiedId(item.id);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopiedId(null), 1500);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [cancelLongPress]);

  const handleRegenerate = useCallback(async () => {
    const target = longPressMsg;
    setLongPressMsg(null);
    if (!target || !conversation || sending) return;
    const msgs = conversation.messages;
    const lastUserIdx = [...msgs].reverse().findIndex((m) => m.role === "user");
    if (lastUserIdx === -1) return;
    const userIdx = msgs.length - 1 - lastUserIdx;
    if (userIdx !== target.index) return; // only regenerate the last user message
    haptic();

    // Pop the placeholder/error assistant message locally
    const trimmed = msgs.slice(0, userIdx + 1);
    const nextConv = { ...conversation, messages: trimmed, updatedAt: Date.now() };
    await setRawConversationList((await getConversations()).map((c) => (c.id === c.id && c.id === conversation.id ? nextConv : c)));
    setConversation(nextConv);
    const display: DisplayMessage[] = trimmed.map((m) => ({
      id: m.id,
      role: m.role,
      text: m.text,
      error: m.error,
      imageUri: m.imageUri,
      createdAt: m.createdAt,
    }));
    display.push({ id: `a-${Date.now()}`, role: "assistant", text: "" });
    setMessages(display);
    setBusyModel(effectiveModelKey);
    setSending(true);

    const userMsg = msgs[userIdx];
    const history = [
      { role: "system" as const, text: await getConversationSystemPrompt(conversation?.templateId, conversation?.chatMode, conversation?.translateTarget) },
      ...trimmed.slice(0, -1).map((m) => ({ role: m.role, text: m.text })),
      { role: "user" as const, text: userMsg.text },
    ];
    const image: ImageAttachment | null = userMsg.imageUri
      ? (() => {
          const img = display.find((d) => d.imageUri === userMsg.imageUri);
          void img;
          return null;
        })()
      : null;
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      await streamChat({
        modelKey: effectiveModelKey,
        messages: history,
        image,
        onToken: (token) => {
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last && last.role === "assistant") {
              copy[copy.length - 1] = { ...last, text: last.text + token };
            }
            return copy;
          });
          appendAssistantText(conversation.id, token);
        },
        signal: abort.signal,
      });
    } catch (e) {
      const errorText = e instanceof Error ? e.message : String(e);
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { id: `a-${Date.now()}`, role: "assistant", text: errorText, error: true };
        return copy;
      });
      await markAssistantError(conversation.id, errorText);
    } finally {
      setSending(false);
      abortRef.current = null;
      setBusyModel(null);
      if (cloudSyncOn) requestSync();
    }
    const freshRegen = await getConversation(conversation.id);
    if (freshRegen) await onStreamDone(freshRegen);
  }, [longPressMsg, conversation, sending, modelKey, effectiveModelKey, haptic, cloudSyncOn, onStreamDone]);

  const handleDeleteMessage = useCallback(async () => {
    const target = longPressMsg;
    setLongPressMsg(null);
    if (!target || !conversation) return;
    const trimmed = conversation.messages.filter((_, i) => i !== target.index);
    await setRawConversationList((await getConversations()).map((c) =>
      c.id === conversation.id ? { ...c, messages: trimmed, updatedAt: Date.now() } : c,
    ));
    const nextConv = { ...conversation, messages: trimmed, updatedAt: Date.now() };
    setConversation(nextConv);
    setMessages(trimmed.map((m) => ({ id: m.id, role: m.role, text: m.text, error: m.error, imageUri: m.imageUri, createdAt: m.createdAt })));
    haptic();
    if (cloudSyncOn) requestSync();
  }, [longPressMsg, conversation, haptic, cloudSyncOn]);

  const saveEditedMessage = useCallback(async () => {
    const targetId = editingMsgId;
    if (!targetId || !conversation || sending) return;
    const newText = editMsgText.trim();
    if (!newText) return;
    const msgs = conversation.messages;
    const targetIdx = msgs.findIndex((m) => m.id === targetId);
    if (targetIdx === -1 || msgs[targetIdx].role !== "user") {
      setEditingMsgId(null);
      return;
    }
    haptic();
    const edited = msgs.map((m, i) =>
      i === targetIdx ? { ...m, text: newText, createdAt: Date.now() } : m,
    );
    const trimmed = edited.slice(0, targetIdx + 1);
    const nextConv = { ...conversation, messages: trimmed, updatedAt: Date.now() };
    // Update chat title when editing the very first message (single-message chat or first message of any chat)
    if (targetIdx === 0 && (msgs.length === 1 || (msgs[0].role === "user" && msgs.findIndex((m) => m.role === "user") === 0))) {
      nextConv.title = newText.slice(0, 60) || "New Chat";
    } else if (msgs[targetIdx].id === msgs.find((m) => m.role === "user")?.id && trimmed.length === 1) {
      nextConv.title = newText.slice(0, 60) || "New Chat";
    }
    await setRawConversationList((await getConversations()).map((c) => (c.id === c.id && c.id === conversation.id ? nextConv : c)));
    setConversation(nextConv);
    setMessages([
      ...trimmed.map((m) => ({ id: m.id, role: m.role, text: m.text, error: m.error, imageUri: m.imageUri, createdAt: m.createdAt })),
      { id: `a-${Date.now()}`, role: "assistant", text: "", createdAt: Date.now() },
    ]);
    setEditingMsgId(null);
    setEditMsgText("");

    const userMsg = trimmed[targetIdx];
    const history = [
      { role: "system" as const, text: await getConversationSystemPrompt(conversation?.templateId, conversation?.chatMode, conversation?.translateTarget) },
      ...trimmed.slice(0, -1).map((m) => ({ role: m.role, text: m.text })),
      { role: "user" as const, text: userMsg.text },
    ];
    setBusyModel(effectiveModelKey);
    setSending(true);
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      await streamChat({
        modelKey: effectiveModelKey,
        messages: history,
        image: null,
        onToken: (token) => {
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last && last.role === "assistant") {
              copy[copy.length - 1] = { ...last, text: last.text + token };
            }
            return copy;
          });
          appendAssistantText(conversation.id, token);
        },
        signal: abort.signal,
      });
    } catch (e) {
      const errorText = e instanceof Error ? e.message : String(e);
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { id: `a-${Date.now()}`, role: "assistant", text: errorText, error: true };
        return copy;
      });
      await markAssistantError(conversation.id, errorText);
    } finally {
      setSending(false);
      abortRef.current = null;
      setBusyModel(null);
      if (cloudSyncOn) requestSync();
    }
    const freshEdit = await getConversation(conversation.id);
    if (freshEdit) await onStreamDone(freshEdit);
  }, [editingMsgId, editMsgText, conversation, sending, modelKey, effectiveModelKey, haptic, cloudSyncOn, onStreamDone]);

  const parseGenMedia = (text: string): { type: "image" | "audio"; base64: string } | null => {
    if (text.startsWith("__GEN_MEDIA__")) {
      const endIdx = text.lastIndexOf("__END__");
      const inner = endIdx > 0 ? text.slice(11, endIdx) : text.slice(11);
      if (inner.startsWith("image__")) return { type: "image", base64: inner.slice(7) };
      if (inner.startsWith("audio__")) return { type: "audio", base64: inner.slice(7) };
    }
    return null;
  };

  const doQuickArchive = useCallback(() => {
    const conv = conversation;
    if (!conv) return;
    (async () => {
      const { archiveConversation, getConversation } = await import("@/lib/storage");
      await archiveConversation(conv.id, true);
      setModeNotice("Chat archived — it won't auto-delete");
      const fresh = await getConversation(conv.id);
      if (fresh) setConversation(fresh);
    })();
  }, [conversation]);

  // NOTE: swipe actions live in SwipeMessageRow (top-level hooks) — the old
  // useRef/PanResponder-inside-map code crashed the release APK.
  const renderItem = useCallback(
    ({ item, index }: { item: DisplayMessage; index: number }) => {
      const isUser = item.role === "user";
      const isTyping = sending && !isUser && item.text === "" && !item.error && index === messages.length - 1;
      const copied = copiedId === item.id;
      const genMedia = item.text ? parseGenMedia(item.text) : null;
      return (
        <View
          style={[
            styles.msgRow,
            { alignItems: isUser ? "flex-end" : "flex-start", paddingHorizontal: 12, marginVertical: 3 },
          ]}
        >
          {!isUser && (
            <View style={[styles.avatar]}>
              <IconSymbol name={item.text.includes("__DEBATE2__") ? "person.2.fill" : "sparkles"} size={15} color={item.text.includes("__DEBATE2__") ? (colors.warning || "#FBBF24") : colors.primary} />
            </View>
          )}
          <SwipeMessageRow
            onSwipeRight={() => handleCopyMessage(item)}
            onSwipeLeft={() => doQuickArchive()}
            align={isUser ? "flex-end" : "flex-start"}
          >
          <Pressable
            onPressIn={() => cancelLongPress()}
            onPressOut={() => cancelLongPress()}
            onLongPress={() => startLongPress(item.id, index)}
            delayLongPress={550}
            style={({ pressed }) => [pressed && { opacity: 0.85 }]}
          >
            <View
              style={[
                styles.bubble,
                {
                  backgroundColor: isUser ? "#444648" : "transparent",
                  borderRadius: isUser ? 24 : 4,
                  maxWidth: isUser ? "82%" : "88%",
                  paddingHorizontal: isUser ? 16 : 0,
                  paddingVertical: isUser ? 10 : 0,
                },
              ]}
            >
              {item.imageUri && (
                <Image source={{ uri: item.imageUri }} style={styles.bubbleImage} resizeMode="cover" />
              )}
              {genMedia?.type === "image" && genMedia.base64 ? (
                <Image source={{ uri: `data:image/png;base64,${genMedia.base64}` }} style={styles.bubbleImage} resizeMode="contain" />
              ) : genMedia?.type === "audio" && genMedia.base64 ? (
                <GenAudioBubble base64={genMedia.base64} />
              ) : null}
              {isTyping ? (
                <View style={[{ paddingHorizontal: isUser ? 0 : 0 }]}>
                  <TypingDots color={colors.primary} />
                </View>
              ) : item.error ? (
                <Text className="text-error text-sm" style={{ lineHeight: 20 }}>
                  {item.text}
                </Text>
              ) : (
                <MessageText text={item.text.replace(/__DEBATE2__[^\n]*/g, "")} userMessage={isUser} />
              )}
              {!isTyping && item.text !== "" && highlightedId === item.id && (
                <View style={[styles.highlightBar, { backgroundColor: colors.primary + "33" }]} />
              )}
              {!isTyping && item.text !== "" && (
                <View style={[styles.copyRow, { borderTopColor: "transparent", paddingTop: 4 }]}>
                  {!isUser && (
                    <Text className="text-[10px] mr-2" style={{ color: colors.muted }}>
                      {item.createdAt ? messageTime(item.createdAt) : ""}{item.createdAt ? ` · ${Math.max(item.text.trim().split(/\s+/).length - 1, 0)} words` : ""}
                    </Text>
                  )}
                  {item.source && !isUser && !item.genMedia && !item.text.includes("__DEBATE2__") && (
                    <View style={[styles.sourceBadge, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "55" }]}>
                      <IconSymbol name="sparkles" size={9} color={colors.primary} />
                      <Text className="text-[9px] font-semibold" style={{ color: colors.primary, lineHeight: 12 }} numberOfLines={1}>
                        {item.source}
                      </Text>
                    </View>
                  )}
                  {!isUser && (
                    <Pressable
                      onPress={() => toggleSpeak(item)}
                      style={({ pressed }) => [styles.copyBtn, pressed && { opacity: 0.6 }]}
                    >
                      <IconSymbol name={speakingId === item.id ? "stop.fill" : "speaker.wave.2.fill"} size={13} color={speakingId === item.id ? colors.primary : colors.muted} />
                      <Text className="text-[10px]" style={{ color: speakingId === item.id ? colors.primary : colors.muted }}>
                        {speakingId === item.id ? "Stop" : "Listen"}
                      </Text>
                    </Pressable>
                  )}
                  {!isUser && (
                    <Pressable
                      onPress={() => setReactionLocal(item.id, "like")}
                      style={({ pressed }) => [styles.copyBtn, pressed && { opacity: 0.6 }]}
                    >
                      <IconSymbol name={reactions[item.id] === "like" ? "hand.thumbup.fill" : "hand.thumbup"} size={13} color={reactions[item.id] === "like" ? colors.primary : colors.muted} />
                    </Pressable>
                  )}
                  {!isUser && (
                    <Pressable
                      onPress={() => setReactionLocal(item.id, "dislike")}
                      style={({ pressed }) => [styles.copyBtn, pressed && { opacity: 0.6 }]}
                    >
                      <IconSymbol name={reactions[item.id] === "dislike" ? "hand.thumbdown.fill" : "hand.thumbdown"} size={13} color={reactions[item.id] === "dislike" ? colors.error : colors.muted} />
                    </Pressable>
                  )}
                  {!isUser && (
                    <Pressable
                      onPress={() => handleCopyMessage(item)}
                      style={({ pressed }) => [styles.copyBtn, pressed && { opacity: 0.6 }]}
                    >
                      <IconSymbol name={copied ? "checkmark" : "doc.on.doc"} size={13} color={copied ? colors.success : colors.muted} />
                      <Text className="text-[10px]" style={{ color: copied ? colors.success : colors.muted }}>
                        {copied ? "Copied" : "Copy"}
                      </Text>
                    </Pressable>
                  )}
                  {item.offlineDraft && !isConnected && (
                    <View style={[styles.copyBtn, { backgroundColor: colors.warning + "18" }]}>
                      <IconSymbol name="exclamationmark.triangle" size={12} color={colors.warning} />
                      <Text className="text-[10px] font-semibold" style={{ color: colors.warning }}>
                        Offline
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </Pressable>
          </SwipeMessageRow>
        </View>
      );
    },
    [colors, sending, messages.length, copiedId, speakingId, cancelLongPress, startLongPress, handleCopyMessage, doQuickArchive, toggleSpeak, reactions, highlightedId, setReactionLocal, isConnected],
  );

  function onFlatListScroll(e: { nativeEvent: { contentSize: { height: number }; layoutMeasurement: { height: number }; contentOffset: { y: number } } }) {
    const { contentSize, layoutMeasurement, contentOffset } = e.nativeEvent;
    const nearBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 120;
    if (nearBottom !== !scrolledUp) setScrolledUp(!nearBottom);
  }

  const currentModel = getModel(effectiveModelKey);

  const [offlineQueue, setOfflineQueue] = useState<OfflineMessage[]>([]);
  const flushQueue = useCallback(async () => {
    const queue = await getOfflineQueue();
    setOfflineQueue(queue);
  }, []);
  useEffect(() => {
    flushQueue();
  }, [flushQueue]);
  // Auto-send queued drafts when connectivity returns while the user is looking at a chat
  useEffect(() => {
    if (!isConnected || offlineQueue.length === 0 || sending) return;
    // Small delay so the network is stable after reconnecting
    const t = setTimeout(async () => {
      setModeNotice("Network is back — sending queued messages…");
      const next = offlineQueue[0];
      try {
        await removeOfflineMessage(next.id);
      } catch { /* keep it queued; it will retry later */ }
      setInput(next.text);
      setTimeout(() => sendMessageRef.current?.(), 80);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 600);
    return () => clearTimeout(t);
  }, [isConnected, offlineQueue, sending]);

  const composer = (
    <View style={{ backgroundColor: colors.surface, borderTopWidth: 0.5, borderTopColor: colors.border }}>
      {pendingImage && (
        <View style={[styles.imagePreview, { borderColor: colors.border }]}>
          <Image source={{ uri: pendingImage.uri }} style={styles.imagePreviewImg} resizeMode="cover" />
          <Pressable onPress={() => setPendingImage(null)} hitSlop={8} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            <IconSymbol name="xmark" size={18} color="#fff" />
          </Pressable>
        </View>
      )}
      {replyTarget && (
        <View className="flex-row items-center gap-2 px-3 pt-2">
          <View style={[{ flex: 1, backgroundColor: colors.background, borderColor: colors.border, borderWidth: 0.5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 6 }]}>
            <IconSymbol name="quote.bubble" size={14} color={colors.primary} />
            <Text className="flex-1 text-xs text-muted" numberOfLines={2}>
              Replying to: {replyTarget.text.trim().slice(0, 120)}{replyTarget.text.trim().length > 120 ? "…" : ""}
            </Text>
            <Pressable onPress={() => setReplyTarget(null)} hitSlop={8} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
              <IconSymbol name="xmark" size={16} color={colors.muted} />
            </Pressable>
          </View>
        </View>
      )}
      {promptText.length > 0 && !replyTarget && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-3 pt-2" contentContainerStyle={{ gap: 6, alignItems: "center" }}>
          {promptText.slice(0, 5).map((p, i) => (
            <Pressable
              key={`${p}-${i}`}
              onPress={() => useSavedPrompt(p)}
              disabled={sending}
              style={({ pressed }) => [styles.promptChip, { backgroundColor: colors.background, borderColor: colors.border }, pressed && { opacity: 0.7 }]}
            >
              <Text className="text-[11px] text-muted" numberOfLines={1}>{p.slice(0, 30)}{p.length > 30 ? "…" : ""}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <View className="flex-row items-end px-3 pt-2" style={{ gap: 8, paddingBottom: Math.max(insets.bottom, 6) + 2 }}>
        <Pressable
          onPress={pickImage}
          disabled={sending}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
        >
          <IconSymbol name="photo.fill" size={22} color={sending ? colors.muted : colors.primary} />
        </Pressable>
        <Pressable
          onPress={pickPdf}
          disabled={sending}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
        >
          <IconSymbol name="doc.on.doc.fill" size={22} color={sending ? colors.muted : colors.primary} />
        </Pressable>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Message AI"
          placeholderTextColor={colors.muted}
          multiline
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={sendMessage}
          editable={!sending}
          className="flex-1 text-foreground text-base"
          style={{
            backgroundColor: colors.surface,
            borderRadius: 24,
            paddingHorizontal: 16,
            paddingVertical: 10,
            minHeight: 44,
            maxHeight: 120,
            borderWidth: 0,
            color: colors.foreground,
          }}
        />
        <Pressable
          onPress={() => toggleDictation(commitFinalTranscript)}
          onLongPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setModeNotice("Voice message mode — release to send");
            toggleDictation(commitFinalTranscript);
          }}
          delayLongPress={300}
          disabled={sending}
          style={({ pressed }) => [
            styles.iconBtn,
            pressed && { opacity: 0.6 },
          ]}
        >
          <IconSymbol
            name={isListening ? "mic.fill" : "mic"}
            size={22}
            color={isListening ? colors.error : sending ? colors.muted : colors.primary}
          />
        </Pressable>
          <Pressable
            onPress={sending ? stopReply : sendMessage}
            disabled={!sending && !input.trim() && !pendingImage && !pendingPdf}
            style={({ pressed }) => [
              styles.sendBtn,
              { backgroundColor: (!sending && !input.trim() && !pendingImage && !pendingPdf) ? colors.border : sending ? colors.error : colors.primary },
              pressed && { transform: [{ scale: 0.94 }], opacity: 0.9 },
            ]}
          >
          {sending ? (
            <IconSymbol name="stop.fill" size={16} color="#fff" />
          ) : (
            <IconSymbol name="paperplane.fill" size={18} color="#fff" />
          )}
        </Pressable>
      </View>
      {pendingPdf && (
        <View className="flex-row items-center gap-2 px-3 pt-2">
          <View style={[{ flex: 1, backgroundColor: colors.background, borderColor: colors.border, borderWidth: 0.5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 6 }]}>
            <IconSymbol name="doc.on.doc.fill" size={14} color={colors.primary} />
            <Text className="flex-1 text-xs text-muted" numberOfLines={1}>
              PDF: {pendingPdf.name} · {pendingPdf.text.length.toLocaleString()} chars
            </Text>
            <Pressable onPress={() => setPendingPdf(null)} hitSlop={8} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
              <IconSymbol name="xmark" size={16} color={colors.muted} />
            </Pressable>
          </View>
        </View>
      )}
      {modeNotice && (
        <View className="flex-row items-center gap-2 px-3 py-1.5">
            <IconSymbol name="sparkles" size={14} color={colors.primary} />
          <Text className="flex-1 text-[11px] text-muted" numberOfLines={2}>{modeNotice}</Text>
          <Pressable onPress={() => setModeNotice(null)} hitSlop={8} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            <IconSymbol name="xmark" size={14} color={colors.muted} />
          </Pressable>
        </View>
      )}
      {debateNotice && (
        <View className="flex-row items-center gap-2 px-3 py-1.5">
          <IconSymbol name="person.2.fill" size={14} color={colors.warning} />
          <Text className="flex-1 text-[11px] text-muted" numberOfLines={2}>{debateNotice}</Text>
          <Pressable onPress={() => setDebateNotice(null)} hitSlop={8} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            <IconSymbol name="xmark" size={14} color={colors.muted} />
          </Pressable>
        </View>
      )}
      {isListening && (
        <View className="flex-row items-center gap-2 px-3 py-1.5">
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.error }} />
          <Text className="text-[11px] text-error">Listening… tap the mic again to stop</Text>
        </View>
      )}
      {!isListening && dictError && (
        <Text className="text-[11px] text-error px-3 pb-1">{dictError}</Text>
      )}
      {continueVisible && !sending && (
        <View className="flex-row justify-center py-1.5" style={{ backgroundColor: colors.background }}>
          <Pressable
            onPress={continueReply}
            style={({ pressed }) => [styles.continueBtn, { backgroundColor: colors.background, borderColor: colors.border }, pressed && { opacity: 0.7 }]}
          >
            <IconSymbol name="arrow.counterclockwise" size={14} color={colors.primary} />
            <Text className="text-[12px] font-semibold text-foreground">Continue generating</Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  // --- In-chat search sheet ---
  const chatSearchSheet = (
    <Modal visible={chatSearchOpen} transparent animationType="fade" onRequestClose={() => setChatSearchOpen(false)}>
      <Pressable style={styles.backdrop} onPress={() => setChatSearchOpen(false)} />
      <View style={[styles.searchSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View className="flex-row items-center px-4 pt-4" style={{ gap: 8 }}>
          <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
          <TextInput
            value={chatSearchText}
            onChangeText={setChatSearchText}
            placeholder="Search in this chat"
            placeholderTextColor={colors.muted}
            autoFocus={Platform.OS !== "web"}
            returnKeyType="search"
            className="flex-1 text-foreground text-base"
            style={{ color: colors.foreground, paddingVertical: 8 }}
          />
          <Pressable onPress={() => setChatSearchOpen(false)} hitSlop={8} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            <IconSymbol name="xmark" size={18} color={colors.muted} />
          </Pressable>
        </View>
        <FlatList
          data={chatMatches}
          keyExtractor={(m) => m.id}
          style={{ maxHeight: 320 }}
          contentContainerStyle={{ paddingVertical: 6 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => jumpToMatch(item.id)}
              style={({ pressed }) => [styles.menuRow, { borderTopWidth: 0.5, borderTopColor: colors.border }, pressed && { opacity: 0.7 }]}
            >
              <Text className="text-[10px] px-4 pb-1" style={{ color: colors.muted }}>{item.index + 1} of {conversation?.messages.length} messages</Text>
              <Text className="text-sm text-foreground px-4" numberOfLines={2}>{item.snippet}</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            chatSearchText.trim() ? (
              <Text className="text-sm text-muted px-4 py-6 text-center">No matches in this chat</Text>
            ) : (
              <Text className="text-sm text-muted px-4 py-6 text-center">Type to search messages</Text>
            )
          }
        />
      </View>
    </Modal>
  );

  return (
    <ScreenContainer edges={["top", "left", "right"]} containerClassName="bg-background">
      {/* Header */}
      <View
        className="flex-row items-center justify-between px-3"
        style={{
          paddingTop: insets.top + 4,
          paddingBottom: 6,
          backgroundColor: colors.surface,
          borderBottomWidth: 0.5,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable
          onPress={() => setHistoryOpen(true)}
          style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.6 }]}
        >
          <IconSymbol name="square.grid.2x2" size={22} color={colors.foreground} />
        </Pressable>
        <Pressable
          onPress={handleNewChat}
          disabled={sending}
          style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.6 }]}
        >
          <IconSymbol name="square.and.pencil" size={22} color={sending ? colors.muted : colors.foreground} />
        </Pressable>
        <Pressable
          onPress={() => setPickerOpen(true)}
          disabled={pickerOpen}
          style={({ pressed }) => [
            styles.modelChip,
            { backgroundColor: colors.background, borderColor: colors.border },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
            {currentModel?.name ?? modelKey}
          </Text>
          <IconSymbol name="chevron.down" size={14} color={colors.muted} />
        </Pressable>
        {conversation?.chatMode && conversation.chatMode !== "normal" && (
          <Pressable
            onPress={() => setModesVisible(true)}
            style={({ pressed }) => [
              { backgroundColor: colors.primary + "22", borderColor: colors.border, borderWidth: 0.5, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 3, marginLeft: 4 },
              pressed && { opacity: 0.7 },
            ]}
          >
            <IconSymbol name="sparkles" size={12} color={colors.primary} />
            <Text className="text-[11px] font-semibold text-primary" numberOfLines={1}>{MODE_LABELS[conversation.chatMode]}</Text>
          </Pressable>
        )}
        <Pressable
          onPress={() => setCompareOpen(true)}
          disabled={sending}
          style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.6 }]}
        >
          <IconSymbol name="square.grid.2x2.fill" size={20} color={sending ? colors.muted : colors.foreground} />
        </Pressable>
        <Pressable
          onPress={() => {
            setChatSearchText("");
            setChatSearchOpen(true);
            haptic();
          }}
          style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.6 }]}
        >
          <IconSymbol name="magnifyingglass" size={22} color={colors.foreground} />
        </Pressable>
        <Pressable
          onPress={() => setSettingsOpen(true)}
          style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.6 }]}
        >
          <IconSymbol name="gear" size={22} color={colors.foreground} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        {messages.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <View className="items-center gap-3">
              <View style={[styles.heroIcon, { backgroundColor: colors.primary + "22" }]}>
                <IconSymbol name="sparkles" size={32} color={colors.primary} />
              </View>
              <Text className="text-2xl font-bold text-foreground">How can I help?</Text>
              <Text className="text-sm text-muted text-center">
                Ask anything. Attach an image to analyze it{"\n"}(works with vision-capable models).
              </Text>
              <Text className="text-xs text-muted text-center mt-2">
                Chats are saved on this phone and{"\n"}auto-delete {AUTO_DELETE_DAYS} days after the last message (pinned chats are kept).
              </Text>
            </View>
            <View className="w-full mt-8 gap-2.5">
              {welcomePrompts.map((p, i) => (
                <Pressable
                  key={i}
                  onPress={() => sendStarterPrompt(p.text)}
                  disabled={sending}
                  style={({ pressed }) => [
                    styles.starterBtn,
                    { backgroundColor: colors.background, borderColor: colors.border },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text className="text-sm text-foreground" style={{ lineHeight: 20 }}>
                    {p.emoji} {p.text}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <>
            {suggestions.length > 0 && !sending && messages.length > 1 && (
              <View className="flex-row flex-wrap px-3 py-2" style={{ gap: 6 }}>
                {suggestions.map((s, i) => (
                  <Pressable
                    key={`${s}-${i}`}
                    onPress={() => {
                      setSuggestions([]);
                      setInput(s);
                    }}
                    style={({ pressed }) => [
                      styles.promptChip,
                      { backgroundColor: colors.background, borderColor: colors.border },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text className="text-[11px] text-muted">{s}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingVertical: 12 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            onScroll={onFlatListScroll}
            onMomentumScrollEnd={onFlatListScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
          />
          </>
        )}
        {/* Floating scroll-to-bottom button */}
        {scrolledUp && (
          <Pressable
            onPress={() => listRef.current?.scrollToEnd({ animated: true })}
            style={({ pressed }) => [
              styles.fab,
              { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.foreground },
              pressed && { opacity: 0.8 },
            ]}
          >
            <IconSymbol name="arrow.down.circle.fill" size={22} color={colors.foreground} />
          </Pressable>
        )}
        {composer}
      </KeyboardAvoidingView>

      {/* Long-press message action menu */}
      <Modal visible={longPressMsg !== null} transparent animationType="fade" onRequestClose={() => setLongPressMsg(null)}>
        <Pressable style={styles.backdrop} onPress={() => setLongPressMsg(null)} />
        <View style={[styles.menu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text className="text-xs text-muted px-4 pt-3">Message options</Text>
          <Pressable
            onPress={() => {
              const msg = messages.find((m) => m.id === longPressMsg?.id);
              if (msg) handleCopyMessage(msg);
            }}
            style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.7 }]}
          >
            <IconSymbol name="doc.on.doc" size={18} color={colors.foreground} />
            <Text className="text-base text-foreground ml-3">Copy message</Text>
          </Pressable>
          {(() => {
            const lastUserIdx = [...conversation?.messages ?? []].reverse().findIndex((m) => m.role === "user");
            const canRegenerate =
              longPressMsg !== null &&
              conversation !== null &&
              !sending &&
              lastUserIdx !== -1 &&
              conversation.messages.length - 1 - lastUserIdx === longPressMsg.index;
            return canRegenerate ? (
              <Pressable onPress={handleRegenerate} style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.7 }]}>
                <IconSymbol name="arrow.counterclockwise" size={18} color={colors.foreground} />
                <Text className="text-base text-foreground ml-3">Regenerate</Text>
              </Pressable>
            ) : null;
          })()}
          {(() => {
            const msg = messages.find((m) => m.id === longPressMsg?.id);
            if (!msg || msg.role !== "user" || sending) return null;
            return (
              <Pressable
                onPress={() => {
                  setEditMsgText(msg.text);
                  setEditingMsgId(msg.id);
                  setLongPressMsg(null);
                  haptic();
                }}
                style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.7 }]}
              >
                <IconSymbol name="pencil" size={18} color={colors.foreground} />
                <Text className="text-base text-foreground ml-3">Edit message</Text>
              </Pressable>
            );
          })()}
          {(() => {
            const msg = messages.find((m) => m.id === longPressMsg?.id);
            if (!msg || sending) return null;
            return (
              <Pressable
                onPress={() => startReply(msg)}
                style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.7 }]}
              >
                <IconSymbol name="reply.fill" size={18} color={colors.foreground} />
                <Text className="text-base text-foreground ml-3">Reply</Text>
              </Pressable>
            );
          })()}
          <Pressable
            onPress={handleExportMarkdown}
            style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.7 }]}
          >
            <IconSymbol name="list.bullet" size={18} color={colors.foreground} />
            <Text className="text-base text-foreground ml-3">Export as Markdown</Text>
          </Pressable>
          <Pressable
            onPress={handleExportHtml}
            style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.7 }]}
          >
            <IconSymbol name="chevron.left.forwardslash.chevron.right" size={18} color={colors.foreground} />
            <Text className="text-base text-foreground ml-3">Export as HTML</Text>
          </Pressable>
          <Pressable
            onPress={handleExportPdf}
            style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.7 }]}
          >
            <IconSymbol name="doc.fill" size={18} color={colors.foreground} />
            <Text className="text-base text-foreground ml-3">Export as PDF</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setTemplatesVisible(true);
              setLongPressMsg(null);
            }}
            style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.7 }]}
          >
            <IconSymbol name="square.grid.2x2.fill" size={18} color={colors.foreground} />
            <Text className="text-base text-foreground ml-3">
              {conversation?.templateId ? "Change template" : "Apply template"}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setModesVisible(true);
              setLongPressMsg(null);
            }}
            style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.7 }]}
          >
            <IconSymbol name="sparkles" size={18} color={colors.foreground} />
            <Text className="text-base text-foreground ml-3">
              {conversation?.chatMode && conversation.chatMode !== "normal" ? "Change mode" : "Apply mode"}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleDeleteMessage}
            style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.7 }]}
          >
            <IconSymbol name="trash.fill" size={18} color={colors.error} />
            <Text className="text-base ml-3" style={{ color: colors.error }}>
              Delete message
            </Text>
          </Pressable>
          <Pressable
            onPress={handleShareChat}
            style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.7 }]}
          >
            <IconSymbol name="square.and.arrow.up" size={18} color={colors.foreground} />
            <Text className="text-base text-foreground ml-3">Share this chat</Text>
          </Pressable>
          {(() => {
            const msg = messages.find((m) => m.id === longPressMsg?.id);
            if (!msg || msg.role !== "assistant" || sending || !msg.text) return null;
            return (
              <Pressable
                onPress={() => {
                  setCanvasText(msg.text);
                  setCanvasOpen(true);
                  setLongPressMsg(null);
                  haptic();
                }}
                style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.7 }]}
              >
                <IconSymbol name="square.and.pencil" size={18} color={colors.foreground} />
                <Text className="text-base text-foreground ml-3">Open in Canvas</Text>
              </Pressable>
            );
          })()}
          <Pressable
            onPress={() => {
              const msg = messages.find((m) => m.id === longPressMsg?.id);
              setReminderDefaultText(msg && msg.role === "assistant" ? msg.text.slice(0, 80) : "");
              setRemindersOpen(true);
              setLongPressMsg(null);
              haptic();
            }}
            style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.7 }]}
          >
            <IconSymbol name="bell.fill" size={18} color={colors.foreground} />
            <Text className="text-base text-foreground ml-3">Set reminder</Text>
          </Pressable>
        </View>
      </Modal>

      {/* Model compare sheet */}
      <CompareSheet
        visible={compareOpen}
        onClose={() => setCompareOpen(false)}
        initialPrompt={input}
      />

      {/* Chat templates sheet */}
      <TemplatesSheet
        visible={templatesVisible}
        onClose={() => setTemplatesVisible(false)}
        currentTemplateId={conversation?.templateId}
        onApply={handleApplyTemplate}
      />

      {/* Canvas editor with live HTML preview */}
      <CanvasScreen
        visible={canvasOpen}
        onClose={() => setCanvasOpen(false)}
        initialText={canvasText}
        onApply={(text) => {
          setInput(text);
          haptic();
        }}
      />

      {/* Local reminders sheet */}
      <RemindersSheet
        visible={remindersOpen}
        onClose={() => setRemindersOpen(false)}
        defaultText={reminderDefaultText}
      />

      {/* Resume builder sheet */}
      <ResumeSheet visible={resumeOpen} onClose={() => setResumeOpen(false)} />

      {/* Debate mode sheet */}
      <DebateSheet
        visible={debateOpen}
        onClose={() => setDebateOpen(false)}
        currentModelKey={effectiveModelKey}
        onApply={(model2Key, rounds) => handleStartDebate(model2Key, rounds)}
      />

      {/* Knowledge base sheet */}
      <KbSheet visible={kbOpen} onClose={() => setKbOpen(false)} />

      {/* Chat modes sheet (normal / deep research / thinking / translator / math / design-to-code) */}
      <ModesSheet
        visible={modesVisible}
        onClose={() => setModesVisible(false)}
        currentMode={conversation?.chatMode ?? "normal"}
        targetLanguage={conversation?.translateTarget}
        onApply={(mode, lang) => handleApplyMode(mode, lang)}
      />

      {/* Edit message dialog */}
      <Modal visible={editingMsgId !== null} transparent animationType="fade" onRequestClose={() => setEditingMsgId(null)}>
        <Pressable style={styles.backdrop} onPress={() => setEditingMsgId(null)} />
        <KeyboardAvoidingView
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, top: 0, justifyContent: "center" }}
          behavior="padding"
        >
          <View style={[styles.menu, { backgroundColor: colors.surface, borderColor: colors.border, width: "85%" }]}>
            <Text className="text-base font-bold text-foreground px-4 pt-4">Edit message</Text>
            <Text className="text-[11px] text-muted px-4 pt-1">
              Everything after this message will be removed and re-generated.
            </Text>
            <TextInput
              value={editMsgText}
              onChangeText={setEditMsgText}
              placeholder="Your message"
              placeholderTextColor={colors.muted}
              multiline
              autoFocus={Platform.OS !== "web"}
              className="text-foreground text-base"
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.background,
                borderRadius: 12,
                marginHorizontal: 16,
                marginTop: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                minHeight: 80,
                maxHeight: 180,
                color: colors.foreground,
                textAlignVertical: "top",
              }}
            />
            <View className="flex-row px-4 pt-4 pb-2 gap-2">
              <Pressable
                onPress={() => setEditingMsgId(null)}
                style={({ pressed }) => [styles.confirmBtn, { backgroundColor: colors.border }, pressed && { opacity: 0.7 }]}
              >
                <Text className="text-sm font-semibold text-foreground">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => saveEditedMessage()}
                disabled={sending || !editMsgText.trim()}
                style={({ pressed }) => [
                  styles.confirmBtn,
                  { backgroundColor: sending || !editMsgText.trim() ? colors.border : colors.primary },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text className="text-sm font-semibold text-white">Save & Resend</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ModelPicker
        visible={pickerOpen}
        currentKey={effectiveModelKey}
        keyAvailability={keyAvailability}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSelectModel}
      />
      <SettingsModal
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={refreshKeyAvailability}
      />
      {chatSearchSheet}

      <HistorySheet
        visible={historyOpen}
        activeId={conversation?.id ?? null}
        onClose={() => setHistoryOpen(false)}
        onOpen={handleOpenConversation}
        onNew={handleNewChat}
        onDelete={handleDeleteConversation}
        onClearAll={handleClearAll}
        onRename={() => {
          if (cloudSyncOn) requestSync();
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerBtn: {
    padding: 6,
  },
  modelChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    maxWidth: "62%",
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  msgRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  bubble: {
    borderRadius: 18,
  },
  bubbleImage: {
    width: 220,
    height: 140,
    borderRadius: 14,
    marginHorizontal: 12,
    marginTop: 10,
  },
  iconBtn: {
    padding: 6,
    marginBottom: 4,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  imagePreview: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  imagePreviewImg: {
    width: 72,
    height: 72,
    borderRadius: 12,
  },
  copyRow: {
    borderTopWidth: 0.5,
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sourceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 0.5,
    marginLeft: 4,
    maxWidth: 180,
  },
  promptChip: {
    borderWidth: 0.5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: 170,
  },
  continueBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 0.5,
  },
  highlightBar: {
    position: "absolute",
    left: 4,
    top: 4,
    bottom: 4,
    right: 4,
    borderRadius: 14,
  },
  searchSheet: {
    position: "absolute",
    alignSelf: "center",
    top: "20%",
    width: "88%",
    borderRadius: 16,
    borderWidth: 0.5,
  },
  fab: {
    position: "absolute",
    right: 12,
    bottom: 76,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 0.5,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  menu: {
    position: "absolute",
    alignSelf: "center",
    top: "38%",
    width: "80%",
    borderRadius: 16,
    borderWidth: 0.5,
    paddingBottom: 8,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  starterBtn: {
    borderWidth: 0.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  confirmBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 11,
  },
});

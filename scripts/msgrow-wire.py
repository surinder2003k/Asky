P = "/home/ubuntu/ai_chat_app/src/components/ChatScreen.tsx"
s = open(P).read()

# 1. Add speak state + handler after replyToMsg state
anchor = """  const [replyToMsg, setReplyToMsg] = useState<ChatMessage | null>(null);"""
addition = """  const [ttsSpeakingId, setTtsSpeakingId] = useState<string | null>(null);
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
    const text = (el?.textContent || msg.content || "").replace(/\\s+/g, " ").trim();
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
  }"""
s = s.replace(anchor, anchor + "\n" + addition, 1)

# 2. chatWidth on messages container (in-chat view: 'mx-auto w-full max-w-3xl' near scroll buttons ~770)
s = s.replace(
    '<div className="shrink-0 border-t border-[var(--asky-border)] px-3 py-3">\n        <div className="mx-auto w-full max-w-3xl">',
    '<div className="shrink-0 border-t border-[var(--asky-border)] px-3 py-3">\n        <div className={`mx-auto w-full ${settings.chatWidth === "compact" ? "max-w-2xl" : "max-w-3xl"}`}>',
    1,
)

# 3. Messages container width (flex-col max-w-3xl ~670 area)
import re
for pat in ['className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-4 pt-6 pb-2 max-w-3xl mx-auto"',
            'className="mx-auto flex w-full max-w-3xl flex-col gap-1"']:
    pass
# find occurrences of max-w-3xl flex-col
m = list(re.finditer(r'max-w-3xl flex-col', s))
print("max-w-3xl flex-col occurrences:", len(m))
if len(m) == 1:
    s = s[:m[0].start()] + 'max-w-3xl' + s[m[0].end():]
    # replace the whole className dynamically
    start = s.rfind('className="', 0, m[0].start())
    cls = s[start+len('className="'):m[0].start()-0]
    # rebuild
    clsFull = s[start:m[0].end()]
    newCls = 'className={`mx-auto w-full ${settings.chatWidth === "compact" ? "max-w-2xl" : "max-w-3xl"} flex-col gap-1`}'
    # find className="... max-w-3xl flex-col ..."' boundaries
    closeQuote = s.find('"', m[0].end())
    full = s[start:closeQuote+1]
    cls_inner = s[start+len('className="'):closeQuote]
    D = chr(36)
    tpl = D + '{settings.chatWidth === "compact" ? "max-w-2xl" : "max-w-3xl"}'
    cls_new_inner = cls_inner.replace("max-w-3xl", tpl).replace("mx-auto w-full", tpl).strip()
    full = 'className={`' + cls_new_inner + '`}'
    s = s[:start] + full + s[closeQuote+1:]
else:
    # messages container is the FIRST one (chat view); replace only the first flex-col occurrence
    start = s.rfind('className="', 0, m[0].start())
    closeQuote = s.find('"', m[0].end())
    cls_inner = s[start+len('className="'):closeQuote]
    D = chr(36)
    cls_new_inner = cls_inner.replace("max-w-3xl", D + '{settings.chatWidth === "compact" ? "max-w-2xl" : "max-w-3xl"}').strip()
    full = 'className={`' + cls_new_inner + '`}'
    s = s[:start] + full + s[closeQuote+1:]

# 4. Wire new MessageRow props (after regenSelected={pendingRegenFor === m.id})
anchor2 = """              regenSelected={pendingRegenFor === m.id}"""
add2 = """              onReplyTo={m.role === "assistant" && m.done && !isStreaming ? (msg) => setReplyToMsg(msg) : undefined}
              onTogglePin={chat ? () => toggleMessagePin(chat.id, m.id) : undefined}
              onSpeak={m.role === "assistant" && m.done && !isStreaming ? speakMessage : undefined}
              ttsEnabled={settings.ttsEnabled}
              ttsSpeaking={ttsSpeakingId === m.id}
              isPinned={(chat?.pinnedMsgIds || []).includes(m.id)}
              isLastAssistant={isLastAssistantMsg(m.id)}"""
s = s.replace(anchor2, anchor2 + "\n" + add2, 1)

open(P, "w").write(s)
print("done")

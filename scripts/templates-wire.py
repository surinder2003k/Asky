P = "/home/ubuntu/ai_chat_app/src/components/ChatScreen.tsx"
s = open(P).read()
D = chr(36)

def repl(old, new, count=1):
    global s
    assert s.count(old) >= count, f"anchor not found ({count}): {old[:80]}"
    s = s.replace(old, new, count)

# 1. Templates icon import
repl(
    'Star, Pencil, Volume2, VolumeX, Bookmark, BookmarkCheck, ChevronsDownUp, CornerDownRight } from "lucide-react";',
    'Star, Pencil, Volume2, VolumeX, Bookmark, BookmarkCheck, ChevronsDownUp, CornerDownRight, ListChecks } from "lucide-react";',
)

# 2. Home composer: state (add after extraImages state) + template chip before textarea; use unique anchors
repl(
    '  const [showTemplates, setShowTemplates] = useState(false);\n  const [replyToMsg, setReplyToMsg]',
    '  const [showTemplates, setShowTemplates] = useState(false);\n  const [showChatTemplates, setShowChatTemplates] = useState(false);\n  const [replyToMsg, setReplyToMsg]',
    1,
)

# 3. Home composer dropdown + button: anchor on the extras grid end + composer wrapper div
home_anchor = """              ))}
            </div>
          )}
          <div className="flex items-end gap-2 rounded-2xl border border-[var(--asky-border)] bg-[var(--asky-bg-input)] px-3 py-2">"""
home_add = """              ))}
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
                        setInput((prev) => (prev ? prev + "\\n" + t.content : t.content));
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
          <div className="flex items-end gap-2 rounded-2xl border border-[var(--asky-border)] bg-[var(--asky-bg-input)] px-3 py-2">"""
repl(home_anchor, home_add, 1)

# 4. Chat composer dropdown + button: anchor on its own extras grid end
chat_anchor = """                    onClick={() => setExtraImages((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute -right-1 -top-1 rounded-full bg-[var(--asky-bg-elev)] p-0.5"
                  >
                    <X size={11} />
                  </button>"""
# find this in the chat composer (the one with X size 11); anchor via surrounding block — instead anchor on 'mx-auto w-full' composer wrapper
chat_anchor2 = """      <div className="shrink-0 border-t border-[var(--asky-border)] px-3 py-3">
        <div className={`mx-auto w-full ${"""
chat_add2 = """      <div className="shrink-0 border-t border-[var(--asky-border)] px-3 py-3">
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
                      setInput((prev) => (prev ? prev + "\\n" + t.content : t.content));
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
        <div className={`mx-auto w-full ${"""
# careful: setInput((prev) => ...) may not exist (input is string, not callback). Use simple setInput(prev => ...) works with useState<T>! Actually setInput accepts string OR updater? useState<string>("") setter accepts string only in TS — pass string instead.
chat_add2 = chat_add2.replace('setInput((prev) => (prev ? prev + "\\n" + t.content : t.content))', 'setInput((p) => (p ? p + "\\n" + t.content : t.content))')
repl(chat_anchor2, chat_add2, 1)

# Also fix home composer same: use updater form is fine (Dispatch<SetStateAction<string>> accepts updater function; TS ok since useState<string>)

open(P, "w").write(s)
print("done")

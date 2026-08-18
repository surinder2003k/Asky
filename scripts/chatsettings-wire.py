P = "/home/ubuntu/ai_chat_app/src/components/ChatScreen.tsx"
s = open(P).read()

def repl(old, new, count=1):
    global s
    assert s.count(old) >= count, f"anchor not found ({count}): {old[:100]}"
    s = s.replace(old, new, count)

# 1. Settings icon import
repl(
    'Star, Pencil, Volume2, VolumeX, Bookmark, BookmarkCheck, ChevronsDownUp, CornerDownRight, ListChecks } from "lucide-react";',
    'Star, Pencil, Volume2, VolumeX, Bookmark, BookmarkCheck, ChevronsDownUp, CornerDownRight, ListChecks, Settings } from "lucide-react";',
    1,
)

# 2. State for chat settings panel (after showChatTemplates state)
repl(
    '  const [showChatTemplates, setShowChatTemplates] = useState(false);',
    '  const [showChatTemplates, setShowChatTemplates] = useState(false);\n  const [chatSettingsOpen, setChatSettingsOpen] = useState(false);\n  const [chatSystemPrompt, setChatSystemPrompt] = useState(chat?.systemPrompt || "");',
    1,
)

# 3. Header: add settings button at end of header (anchor: last </header>)
hdr_anchor = """        <ModelChip
          model={model}
          setModelKey={(k) => {
            updateChat(chat.id, { modelKey: k });"""
# find where header closes; anchor on the ModelChip end near header — simpler: add button right before </header>
repl(
    '      </header>\n\n      {/* in-chat find toolbar */}',
    '      <button\n        onClick={() => {\n          setChatSystemPrompt(chat?.systemPrompt || "");\n          setChatSettingsOpen(true);\n        }}\n        className="rounded-md p-2 text-[var(--asky-fg-muted)] hover:bg-white/5 hover:text-[var(--asky-fg)]"\n        title="Chat settings (system prompt)"\n      >\n        <Settings size={17} />\n      </button>\n      </header>\n      {chatSettingsOpen && (\n        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={() => setChatSettingsOpen(false)}>\n          <div\n            className="w-full max-w-lg rounded-2xl border border-[var(--asky-border)] bg-[var(--asky-bg-elev)] p-5 shadow-2xl"\n            onClick={(e) => e.stopPropagation()}\n          >\n            <div className="mb-3 flex items-center justify-between">\n              <h3 className="text-lg font-semibold">Chat settings</h3>\n              <button onClick={() => setChatSettingsOpen(false)} className="rounded-md p-1 hover:bg-white/10">\n                <X size={16} />\n              </button>\n            </div>\n            <label className="mb-1 block text-xs text-[var(--asky-fg-muted)]">\n              System prompt\n              <span className="ml-1 text-[10px] text-[var(--asky-fg-muted)]/70">(instructions applied to every message in this chat)</span>\n            </label>\n            <textarea\n              value={chatSystemPrompt}\n              onChange={(e) => setChatSystemPrompt(e.target.value)}\n              rows={6}\n              placeholder="e.g. Reply in short bullet points. Always explain like I am 12."\n              className="w-full rounded-lg border border-[var(--asky-border)] bg-[var(--asky-bg-input)] p-3 text-sm outline-none focus:border-[var(--asky-accent)]"\n            />\n            <div className="mt-3 flex justify-end gap-2">\n              <button\n                onClick={() => setChatSettingsOpen(false)}\n                className="rounded-md px-3 py-1.5 text-sm hover:bg-white/10"\n              >\n                Cancel\n              </button>\n              <button\n                onClick={() => {\n                  updateChat(chat.id, { systemPrompt: chatSystemPrompt });\n                  setChatSettingsOpen(false);\n                }}\n                className="rounded-md bg-[var(--asky-accent)] px-3 py-1.5 text-sm text-white"\n              >\n                Save\n              </button>\n            </div>\n          </div>\n        </div>\n      )}\n      {/* search */}',
    1,
)

# 4. Keep chatSystemPrompt in sync when switching chats — update state when chat.id changes
repl(
    '  const hasContent = chat.messages.length > 0;',
    '  const hasContent = chat.messages.length > 0;\n  React.useEffect(() => {\n    setChatSystemPrompt(chat?.systemPrompt || "");\n  }, [chat?.id]);',
    1,
)

open(P, "w").write(s)
print("done")

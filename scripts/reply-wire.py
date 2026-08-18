P = "/home/ubuntu/ai_chat_app/src/components/ChatScreen.tsx"
s = open(P).read()

def repl(old, new, count=1):
    global s
    assert s.count(old) >= count, f"anchor not found ({count}): {old[:80]}"
    s = s.replace(old, new, count)

# 1. Home composer Enter send
repl(
    'if (!isStreaming) send(input, image, undefined, { modelKey: homeModelKey, extraImages });\n                }',
    'if (!isStreaming) {\n                    send(input, image, undefined, { modelKey: homeModelKey, extraImages, replyToMsgId: replyToMsg?.id });\n                    setReplyToMsg(null);\n                  }\n                }',
)

# 2. Home send button
repl(
    'onClick={() => send(input, image, undefined, { modelKey: homeModelKey, extraImages })}',
    'onClick={() => { send(input, image, undefined, { modelKey: homeModelKey, extraImages, replyToMsgId: replyToMsg?.id }); setReplyToMsg(null); }}',
)

# 3. Chat composer Enter send
repl(
    'if (!isStreaming) send(input, image);\n                }',
    'if (!isStreaming) {\n                    send(input, image, undefined, { replyToMsgId: replyToMsg?.id });\n                    setReplyToMsg(null);\n                  }\n                }',
)

# 4. Chat send button
repl(
    'onClick={() => send(input, image)}',
    'onClick={() => { send(input, image, undefined, { replyToMsgId: replyToMsg?.id }); setReplyToMsg(null); }}',
)

# 5. Reply preview strip before both textareas (identical "<textarea" occurrences — anchor with context)
strip = """              {replyToMsg && (
                <div className="mb-1 flex items-center justify-between gap-2 rounded-lg border border-[var(--asky-accent)]/40 bg-[var(--asky-accent-soft)] px-3 py-1.5 text-[11px]">
                  <div className="min-w-0 flex-1 truncate">
                    <span className="text-[var(--asky-accent)]">Replying to:</span>{" "}
                    <span className="text-[var(--asky-fg-muted)]">{replyToMsg.content.slice(0, 90)}</span>
                  </div>
                  <button onClick={() => setReplyToMsg(null)} className="shrink-0 text-[var(--asky-fg-muted)] hover:text-[var(--asky-fg)]">
                    ✕
                  </button>
                </div>
              )}"""
# home composer textarea preceded by label file input; find unique contexts
ctx = s[s.find('onChange={(e) => e.target.files?.[0] && pickImage(e.target.files[0])}'):s.find('onChange={(e) => e.target.files?.[0] && pickImage(e.target.files[0])}')+200]
print("context1 len:", len(ctx))

# Use the send sites already changed as boundaries. Home textarea: search first '<textarea'
idx1 = s.find('<textarea')
idx2 = s.find('<textarea', idx1 + 1)
# find previous textarea end (no, insert before start)
s = s[:idx2] + strip + "\n" + s[idx2:]
s = s[:idx1] + strip + "\n" + s[idx1:]

open(P, "w").write(s)
print("done")

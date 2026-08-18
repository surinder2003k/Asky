import re

P = "/home/ubuntu/ai_chat_app/src/components/ChatScreen.tsx"
s = open(P).read()

# 1. Fix double-replaced className at home composer (line ~468)
s = s.replace(
    '<div className="mx-auto w-full `mx-auto w-full ${settings.chatWidth === "compact" ? "max-w-2xl" : "max-w-3xl"}`">',
    '<div className={`mx-auto w-full ${settings.chatWidth === "compact" ? "max-w-2xl" : "max-w-3xl"}`}>',
    1
)

# 2. Home send button: add extraImages
s = s.replace(
    'onClick={() => send(input, image, undefined, { modelKey: homeModelKey })}',
    'onClick={() => send(input, image, undefined, { modelKey: homeModelKey, extraImages })}',
    1
)

# 3. In-chat composer: container chatWidth — unique because it is followed by {image && ( inside the chat view (no autoSwitchNotice nearby)
# Use exact pattern of the second 'mx-auto w-full max-w-3xl' occurrence after ModelChip(chat) context. Simplest: replace second occurrence via regex over all occurrences
pat = '<div className="mx-auto w-full max-w-3xl">'
occ = [m.start() for m in re.finditer(re.escape(pat), s)]
print("container occurrences:", len(occ))
if len(occ) >= 2:
    s = s[:occ[1]] + s[occ[1]:].replace(pat, '<div className={`mx-auto w-full ${settings.chatWidth === "compact" ? "max-w-2xl" : "max-w-3xl"}`}>', 1)
    # NOTE: this replaces the SECOND occurrence anywhere; there are only 2 (home composer fixed above now contains template literal, so remaining 'mx-auto w-full max-w-3xl' count = 1)
    # Actually after fix #1, home no longer matches pat, so occ should now be 1 => first replace above handled home? verify below.

# 4. In-chat composer grid: second occurrence of 'items-end gap-2 rounded-2xl' is the in-chat composer
pat2 = '<div className="flex items-end gap-2 rounded-2xl border border-[var(--asky-border)] bg-[var(--asky-bg-input)] px-3 py-2">'
occ2 = [m.start() for m in re.finditer(re.escape(pat2), s)]
print("composer items-end occurrences:", len(occ2))
grid = """          {extraImages.length > 0 && (
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
"""
if len(occ2) >= 2:
    s = s[:occ2[1]] + grid + s[occ2[1]:]

# 5. In-chat send: { modelKey: chat.modelKey } — add extraImages
if 'send(input, image, undefined, { modelKey: chat.modelKey })' in s:
    s = s.replace(
        'send(input, image, undefined, { modelKey: chat.modelKey })',
        'send(input, image, undefined, { modelKey: chat.modelKey, extraImages })',
        1
    )
# and its disabled guard
if 'disabled={!input.trim() && !image}' in s:
    s = s.replace(
        'disabled={!input.trim() && !image}',
        'disabled={!input.trim() && !image && extraImages.length === 0}',
        1
    )

open(P, "w").write(s)
print("done")

import re

P = "/home/ubuntu/ai_chat_app/src/components/ChatScreen.tsx"
s = open(P).read()

# 1. Home composer container: use surrounding suggestion buttons as unique context
old = r"""            <button
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
        <div className="mx-auto w-full max-w-3xl">
          {image && ("""
new = old.replace('        <div className="mx-auto w-full max-w-3xl">\n          {image && (',
        '`        <div className={`mx-auto w-full ${settings.chatWidth === "compact" ? "max-w-2xl" : "max-w-3xl"}`}>`' + '\n          {image && (')
if s.count(old) == 1:
    s = s.replace(old, new, 1)
else:
    print("anchor1 count:", s.count(old))
    raise SystemExit(1)

# 2. Home composer image block: extends context with home-specific autoSwitchNotice block before it (file currently has literal backtick className)
old = r"""      {autoSwitchNotice && (
        <div className="shrink-0 border-t border-[var(--asky-border)] bg-[var(--asky-accent-soft)] px-3 py-2 text-center text-[12px] text-[var(--asky-accent)]">
          {autoSwitchNotice}
        </div>
      )}

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
          <div className="flex items-end gap-2 rounded-2xl border border-[var(--asky-border)] bg-[var(--asky-bg-input)] px-3 py-2">"""
new = old.replace('          <div className="flex items-end gap-2 rounded-2xl border border-[var(--asky-border)] bg-[var(--asky-bg-input)] px-3 py-2">',
'''          {extraImages.length > 0 && (
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
          <div className="flex items-end gap-2 rounded-2xl border border-[var(--asky-border)] bg-[var(--asky-bg-input)] px-3 py-2">''')
if s.count(old) == 1:
    s = s.replace(old, new, 1)
else:
    print("anchor2 count:", s.count(old))
    raise SystemExit(1)

# 3. Home multi-file picker: unique anchor = 'pickImage(e.target.files[0])' followed by '/>' then '            </label>'
old = """              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && pickImage(e.target.files[0])}
              />"""
new = """              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = [...(e.target.files || [])];
                  if (files.length === 0) return;
                  if (!image) pickImage(files[0]);
                  if (files.length > 1) addExtraImages(files.slice(1));
                  e.target.value = "";
                }}
              />"""
n = s.count(old)
s = s.replace(old, new)  # both composers get multi-file; fine
print("anchor3 count:", n)

# 4. Home paste handler: unique anchor = 'pickImage(file);' (both composers: paste to extras when primary occupied)
old = """              onPaste={(e) => {
                const file = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"));
                if (file) {
                  e.preventDefault();
                  pickImage(file);
                }
              }}"""
new = """              onPaste={(e) => {
                const files = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/"));
                if (files.length === 0) return;
                e.preventDefault();
                if (!image) pickImage(files[0]);
                if (files.length > 1) addExtraImages(files.slice(1));
              }}"""
n = s.count(old)
s = s.replace(old, new)
print("anchor4 count:", n)

# 5. Home send with extraImages: both composers; first has homeModelKey
old = "onClick={() => send(input, image, undefined, { modelKey: homeModelKey })}\n              disabled={!input.trim() && !image}"
new = "onClick={() => send(input, image, undefined, { modelKey: homeModelKey, extraImages })}\n              disabled={!input.trim() && !image && extraImages.length === 0}"
n = s.count(old)
s = s.replace(old, new)
print("anchor5 count:", n)

open(P, "w").write(s)
print("done")

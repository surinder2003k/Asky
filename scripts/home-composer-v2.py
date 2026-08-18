P = "/home/ubuntu/ai_chat_app/src/components/ChatScreen.tsx"
lines = open(P).readlines()

def replace_block(start_pat, end_pat, replacement_lines):
    global lines
    # find start line index (0-based)
    si = next(i for i, l in enumerate(lines) if start_pat in l)
    ei = next(i for i in range(si, len(lines)) if end_pat in lines[i])
    before = lines[:si]
    after = lines[ei + 1:]
    lines = before + [r + "\n" for r in replacement_lines] + after

# --- Edit A: home composer container max-w-3xl -> chatWidth conditional ---
# unique context: autoSwitchNotice block right before the home composer
replace_block(
    "Asky can make mistakes. Verify important information.",
    "max-w-3xl",
    [],
) if False else None

# simpler: do single-line replacements via pattern find with uniqueness checks

def sub_one(pat, rep, label):
    global lines
    n = sum(1 for l in lines if pat in l)
    if n == 1:
        lines = [l.replace(pat, rep) if pat in l else l for l in lines]
        print(f"[ok] {label}")
    else:
        print(f"[count {n}] {label}")

# A. chatWidth on home composer container — unique with suggestions context
sub_one(
    """        <div className="mx-auto w-full max-w-3xl">
          {image && (""",
    """        <div className={`mx-auto w-full ${settings.chatWidth === "compact" ? "max-w-2xl" : "max-w-3xl"}`}>
          {image && (""",
    "home composer container chatWidth")

# B. extraImages grid after primary image block (home only: context includes autoSwitchNotice above)
sub_one(
    """              <button
                onClick={() => setImage(null)}
                className="absolute -right-2 -top-2 rounded-full bg-[var(--asky-bg-elev)] p-0.5"
              >
                <X size={14} />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2 rounded-2xl border border-[var(--asky-border)] bg-[var(--asky-bg-input)] px-3 py-2">""",
    """              <button
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
          <div className="flex items-end gap-2 rounded-2xl border border-[var(--asky-border)] bg-[var(--asky-bg-input)] px-3 py-2">""",
    "extraImages grid after image block")

open(P, "w").writelines(lines)
print("wrote file")

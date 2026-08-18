P = "/home/ubuntu/ai_chat_app/src/components/ChatScreen.tsx"
s = open(P).read().split("\n")

def check(i, pat):
    if i < len(s) and pat in s[i]:
        return True
    print(f"UNEXPECTED at {i}: {s[i][:80]!r}")
    return False

# 468 (idx 467): container chatWidth
assert check(467, 'mx-auto w-full max-w-3xl'), s[467]
s[467] = s[467].replace('max-w-3xl', '`mx-auto w-full ${settings.chatWidth === "compact" ? "max-w-2xl" : "max-w-3xl"}`')

# 483 (idx 482): after primary image block insert extras grid before items-end line (idx 484)
assert check(484, 'items-end gap-2 rounded-2xl'), s[484]
grid = [
    '          {extraImages.length > 0 && (',
    '            <div className="mb-2 grid grid-flow-col auto-cols-max gap-2 overflow-x-auto">',
    '              {extraImages.map((src, i) => (',
    '                <div key={i} className="relative inline-block">',
    '                  <img',
    '                    src={src}',
    '                    alt={`attachment ${i + 2}`}',
    '                    onClick={() => setViewerSrc(src)}',
    '                    className="h-16 cursor-pointer rounded-lg border border-[var(--asky-border)] hover:opacity-90"',
    '                  />',
    '                  <button',
    '                    onClick={() => setExtraImages((prev) => prev.filter((_, j) => j !== i))}',
    '                    className="absolute -right-1.5 -top-1.5 rounded-full bg-[var(--asky-bg-elev)] p-0.5"',
    '                  >',
    '                    <X size={12} />',
    '                  </button>',
    '                </div>',
    '              ))}',
    '            </div>',
    '          )}',
]
s = s[:484] + grid + s[484:]

# now: multi-file picker at ~491-494 idx; find by pattern after insertion
i = next(i for i, l in enumerate(s) if 'onChange={(e) => e.target.files?.[0] && pickImage' in l)
s[i] = s[i].replace(
    'onChange={(e) => e.target.files?.[0] && pickImage(e.target.files[0])}',
    'onChange={(e) => { const files = [...(e.target.files || [])]; if (files.length === 0) return; if (!image) pickImage(files[0]); if (files.length > 1) addExtraImages(files.slice(1)); e.target.value = ""; }}'
)
print("picker lines:", [l for l in s if 'addExtraImages' in l][:2])

# multi-file attr: add multiple to file inputs
for idx, l in enumerate(s):
    if 'accept="image/*"' in l and 'multiple' not in s[idx - 1] and 'multiple' not in s[idx + 1]:
        s[idx] = l.replace('accept="image/*"', 'accept="image/*"\n                multiple')
        print("added multiple at", idx)

# paste handler: both composers
i = next(i for i, l in enumerate(s) if 'const file = [...e.clipboardData.files].find' in l)
s[i] = s[i].replace(
    'const file = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"));',
    'const files = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/"));'
)
# next block: if (file) { e.preventDefault(); pickImage(file); }
j = next(j for j in range(i, len(s)) if 'if (file)' in s[j])
s[j] = s[j].replace('if (file) {', 'if (files.length === 0) return;')
k = next(k for k in range(j, len(s)) if 'pickImage(file);' in s[k])
s[k] = s[k].replace(
    '                  pickImage(file);',
    '                  if (!image) pickImage(files[0]);\n                  if (files.length > 1) addExtraImages(files.slice(1));'
)
m = next(m for m in range(k, len(s)) if 'e.preventDefault();' in s[m])
# keep one e.preventDefault before; check ordering
print("paste at", i, j, k)

# send buttons with extraImages
i = next(i for i, l in enumerate(s) if 'send(input, image, undefined, { modelKey: homeModelKey })' in l)
s[i] = s[i].replace(
    'send(input, image, undefined, { modelKey: homeModelKey })',
    'send(input, image, undefined, { modelKey: homeModelKey, extraImages })'
)
d = next(d for d in range(i, len(s)) if 'disabled={!input.trim() && !image}' in s[d])
s[d] = s[d].replace('disabled={!input.trim() && !image}', 'disabled={!input.trim() && !image && extraImages.length === 0}')
print("send at", i, d)

open(P, "w").write("\n".join(s))
print("wrote", len(s))

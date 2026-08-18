import re

# ---- store.tsx: add moveFolder ----
P1 = "/home/ubuntu/ai_chat_app/src/store.tsx"
s1 = open(P1).read()
added = False
if "moveFolder:" not in s1:
    s1 = s1.replace(
        '  setTemplates: (templates: Settings["templates"]) => void;',
        '  setTemplates: (templates: Settings["templates"]) => void;\n  moveFolder: (id: string, dir: 1 | -1) => void;',
    )
    # impl after deleteFolder impl
    m = re.search(r'(deleteFolder: \(id\)[^{]*\{[^}]*\})', s1, re.DOTALL)
    if m:
        impl = """
      moveFolder: (id, dir) => {
        setFoldersState((fs) => {
          const idx = fs.findIndex((f) => f.id === id);
          const swap = idx + dir;
          if (idx < 0 || swap < 0 || swap >= fs.length) return fs;
          const next = [...fs];
          [next[idx], next[swap]] = [next[swap], next[idx]];
          return next;
        });
      },"""
        s1 = s1.replace(m.group(1), m.group(1) + impl)
        added = True
    open(P1, "w").write(s1)
print("store moveFolder:", added or ("moveFolder:" in open(P1).read()))

# ---- Sidebar.tsx ----
P2 = "/home/ubuntu/ai_chat_app/src/components/Sidebar.tsx"
s2 = open(P2).read()

# 1. icons + import exportAllChatsZip
s2 = s2.replace(
    '  Info,\n} from "lucide-react";',
    '  Info,\n  Archive,\n  ChevronUp,\n  ChevronDown,\n} from "lucide-react";',
)
s2 = s2.replace(
    "exportChatToWhatsApp } from \"../export\";",
    "exportChatToWhatsApp, exportAllChatsZip } from \"../export\";",
)

# 2. destruct moveFolder in useApp
s2 = s2.replace(
    "    deleteFolder,\n    clearConversations,",
    "    deleteFolder,\n    moveFolder,\n    clearConversations,",
)

# 3. folder header move arrows (after Trash2 button in folder header block)
s2 = s2.replace(
    '''                  <button
                    className="hidden rounded p-1 text-[var(--asky-fg-muted)] hover:bg-white/10 group-hover:block"
                    onClick={() => confirm(`Delete folder "${f.name}"? Chats move to Recent.`) && deleteFolder(f.id)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>''',
    '''                  <button
                    className="hidden rounded p-1 text-[var(--asky-fg-muted)] hover:bg-white/10 group-hover:block"
                    onClick={() => confirm(`Delete folder "${f.name}"? Chats move to Recent.`) && deleteFolder(f.id)}
                    title="Delete folder"
                  >
                    <Trash2 size={12} />
                  </button>
                  <button
                    className="hidden rounded p-1 text-[var(--asky-fg-muted)] hover:bg-white/10 group-hover:block"
                    onClick={() => moveFolder(f.id, -1)}
                    title="Move folder up"
                  >
                    <ChevronUp size={12} />
                  </button>
                  <button
                    className="hidden rounded p-1 text-[var(--asky-fg-muted)] hover:bg-white/10 group-hover:block"
                    onClick={() => moveFolder(f.id, 1)}
                    title="Move folder down"
                  >
                    <ChevronDown size={12} />
                  </button>
                </div>''',
)

# 4. ChatRow: add snippet under title + word count in info. Find ChatRow definition title area
m = re.search(r'<span className="truncate[^>]*>\{chat\.title\}</span>', s2)
if m:
    s2 = s2.replace(
        m.group(0),
        m.group(0)
        + """
                  {(() => {
                    const last = [...chat.messages].reverse().find((x) => x.role === "assistant" && x.content && !x.error);
                    if (!last) return null;
                    return (
                      <span className="mt-0.5 block truncate text-[11px] leading-tight text-[var(--asky-fg-muted)]" title={last.content}>
                        {last.content.slice(0, 60).replace(/\\n/g, " ")}
                      </span>
                    );
                  })()}""",
    )

# 5. Export All button in footer (before/next to import area) — find import button
s2 = s2.replace(
    '''                <button
                  className="rounded-md p-1.5 hover:bg-white/10 hover:text-[var(--asky-fg)]"
                  title="Import chat"''',
    '''                <button
                  className="rounded-md p-1.5 hover:bg-white/10 hover:text-[var(--asky-fg)]"
                  title="Export all chats as zip"
                  onClick={() => exportAllChatsZip(chats.filter((c) => !c.pinned).length > 0 ? chats : chats)}
                >
                  <Archive size={14} />
                </button>
                <button
                  className="rounded-md p-1.5 hover:bg-white/10 hover:text-[var(--asky-fg)]"
                  title="Import chat"''',
)

open(P2, "w").write(s2)
print("sidebar edits applied")

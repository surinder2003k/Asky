import { useEffect, useState } from "react";
import {
  Plus,
  Search,
  FolderPlus,
  Settings as SettingsIcon,
  Trash2,
  MoreVertical,
  Pin,
  MessageSquare,
  X,
  Check,
  PenLine,
} from "lucide-react";
import { useApp } from "../store";
import { clearConversations } from "../storage";

function timeAgo(ts: number) {
  const d = Math.floor((Date.now() - ts) / 60000);
  if (d < 1) return "just now";
  if (d < 60) return `${d}m ago`;
  const h = Math.floor(d / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function Sidebar({
  open,
  onClose,
  onOpenSettings,
}: {
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}) {
  const {
    chats,
    folders,
    activeChatId,
    setActiveChatId,
    createChat,
    deleteChat,
    deleteChats,
    renameChat,
    togglePin,
    moveChat,
    addFolder,
    renameFolder,
    deleteFolder,
    clearConversations,
  } = useApp();
  const [search, setSearch] = useState("");
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const q = search.trim().toLowerCase();
  const filtered = chats.filter(
    (c) =>
      !q ||
      c.title.toLowerCase().includes(q) ||
      c.messages.some((m) => m.content.toLowerCase().includes(q)),
  );
  const pinned = filtered.filter((c) => c.pinned);
  const nonPinned = filtered.filter((c) => !c.pinned);

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[#202020] transition-transform duration-200 lg:static lg:translate-x-0 lg:z-auto ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-3 pt-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => addFolder(prompt("Folder name?") || "New Folder")}
              className="rounded-md p-2 text-[var(--asky-fg-muted)] hover:bg-white/5 hover:text-[var(--asky-fg)]"
              title="New folder"
            >
              <FolderPlus size={18} />
            </button>
            <span className="text-lg font-semibold">Asky</span>
          </div>
          <button
            onClick={onOpenSettings}
            className="rounded-md p-2 text-[var(--asky-fg-muted)] hover:bg-white/5 hover:text-[var(--asky-fg)]"
            title="Settings"
          >
            <SettingsIcon size={18} />
          </button>
          <button
            onClick={() => {
              setSelectMode((v) => {
                if (v) setSelected(new Set());
                return !v;
              });
            }}
            className={`rounded-md p-2 hover:bg-white/5 ${
              selectMode ? "bg-[var(--asky-accent)]/20 text-[var(--asky-accent)]" : "text-[var(--asky-fg-muted)] hover:text-[var(--asky-fg)]"
            }`}
            title="Select chats"
          >
            <MoreVertical size={18} />
          </button>
          <button onClick={onClose} className="rounded-md p-2 text-[var(--asky-fg-muted)] lg:hidden">
            <X size={18} />
          </button>
        </div>

        <div className="px-3 pt-3">
          <button
            onClick={() => createChat()}
            className="flex w-full items-center gap-2 rounded-xl border border-[var(--asky-border)] px-3 py-2.5 text-sm font-medium hover:bg-white/5"
          >
            <Plus size={16} />
            New chat
          </button>
          <div className="relative mt-2">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--asky-fg-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats"
              className="w-full rounded-xl border border-[var(--asky-border)] bg-[#2a2a2a] py-2 pl-8 pr-3 text-sm outline-none focus:border-[var(--asky-accent)]"
            />
          </div>
        </div>

        <nav className="mt-3 flex-1 overflow-y-auto px-2">
          {folders.map((f) => {
            const inFolder = filtered.filter((c) => c.folderId === f.id);
            return (
              <div key={f.id} className="mb-1">
                <div className="group flex items-center gap-1 rounded-lg px-2 py-1.5">
                  {editingFolder === f.id ? (
                    <input
                      autoFocus
                      defaultValue={f.name}
                      className="w-full bg-transparent text-xs font-semibold uppercase tracking-wide outline-none"
                      onBlur={(e) => {
                        setEditingFolder(null);
                        const v = e.target.value.trim();
                        if (v && v !== f.name) renameFolder(f.id, v);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        if (e.key === "Escape") setEditingFolder(null);
                      }}
                    />
                  ) : (
                    <span
                      className="flex-1 truncate text-xs font-semibold uppercase tracking-wide text-[var(--asky-fg-muted)]"
                      onDoubleClick={() => setEditingFolder(f.id)}
                      title="Double-click to rename"
                    >
                      {f.name}
                    </span>
                  )}
                  <button
                    className="hidden rounded p-1 hover:bg-white/10 group-hover:block"
                    onClick={() => setEditingFolder(f.id)}
                    title="Rename folder"
                  >
                    <MoreVertical size={12} />
                  </button>
                  <button
                    className="hidden rounded p-1 text-[var(--asky-fg-muted)] hover:bg-white/10 group-hover:block"
                    onClick={() => confirm(`Delete folder "${f.name}"? Chats move to Recent.`) && deleteFolder(f.id)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                {inFolder.map((c) => (
                  <ChatRow
                    key={c.id}
                    chat={c}
                    active={c.id === activeChatId}
                    selectMode={selectMode}
                    checked={selected.has(c.id)}
                    onToggleSelect={(on) => setSelected((prev) => { const n = new Set(prev); if (on) n.add(c.id); else n.delete(c.id); return n; })}
                    onOpen={() => {
                      setActiveChatId(c.id);
                      setMenuFor(null);
                      onClose();
                    }}
                    onRename={(t) => renameChat(c.id, t)}
                    onDelete={() => deleteChat(c.id)}
                    onPin={() => togglePin(c.id)}
                    onMove={() => moveChat(c.id, null)}
                    editing={editingTitle === c.id}
                    setEditing={(v) => setEditingTitle(v ? c.id : null)}
                    menuOpen={menuFor === c.id}
                    setMenuOpen={(v) => setMenuFor(v ? c.id : null)}
                  />
                ))}
              </div>
            );
          })}

          {pinned.length > 0 && (
            <div className="mb-1">
              <span className="block px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--asky-fg-muted)]">
                Pinned
              </span>
              {pinned.map((c) => (
                <ChatRow
                  key={c.id}
                  chat={c}
                  active={c.id === activeChatId}
                  selectMode={selectMode}
                  checked={selected.has(c.id)}
                  onToggleSelect={(on) => setSelected((prev) => { const n = new Set(prev); if (on) n.add(c.id); else n.delete(c.id); return n; })}
                  onOpen={() => {
                    setActiveChatId(c.id);
                    setMenuFor(null);
                    onClose();
                  }}
                  onRename={(t) => renameChat(c.id, t)}
                  onDelete={() => deleteChat(c.id)}
                  onPin={() => togglePin(c.id)}
                  onMove={(f) => moveChat(c.id, f)}
                  editing={editingTitle === c.id}
                  setEditing={(v) => setEditingTitle(v ? c.id : null)}
                  menuOpen={menuFor === c.id}
                  setMenuOpen={(v) => setMenuFor(v ? c.id : null)}
                />
              ))}
            </div>
          )}

          {nonPinned.filter((c) => !c.folderId).length > 0 && (
            <div>
              <span className="block px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--asky-fg-muted)]">
                Recent
              </span>
              {nonPinned
                .filter((c) => !c.folderId)
                .map((c) => (
                  <ChatRow
                    key={c.id}
                    chat={c}
                    active={c.id === activeChatId}
                    selectMode={selectMode}
                    checked={selected.has(c.id)}
                    onToggleSelect={(on) => setSelected((prev) => { const n = new Set(prev); if (on) n.add(c.id); else n.delete(c.id); return n; })}
                    onOpen={() => {
                      setActiveChatId(c.id);
                      setMenuFor(null);
                      onClose();
                    }}
                    onRename={(t) => renameChat(c.id, t)}
                    onDelete={() => deleteChat(c.id)}
                    onPin={() => togglePin(c.id)}
                    onMove={(f) => moveChat(c.id, f)}
                    editing={editingTitle === c.id}
                    setEditing={(v) => setEditingTitle(v ? c.id : null)}
                    menuOpen={menuFor === c.id}
                    setMenuOpen={(v) => setMenuFor(v ? c.id : null)}
                  />
                ))}
            </div>
          )}

          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-[var(--asky-fg-muted)]">
              {q ? "No chats match your search." : "No chats yet.\nChats auto-delete after 3 days (pinned chats are kept)."}
            </p>
          )}
        </nav>

        {selectMode && selected.size > 0 && (
          <div className="flex items-center gap-2 border-t border-[var(--asky-border)] px-3 py-2">
            <span className="flex-1 text-xs text-[var(--asky-fg-muted)]">{selected.size} selected</span>
            <button
              className="rounded-full bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/25"
              onClick={() => {
                if (confirm(`Delete ${selected.size} chat${selected.size > 1 ? "s" : ""}?`)) {
                  deleteChats([...selected]);
                  setSelected(new Set());
                  setSelectMode(false);
                }
              }}
            >
              Delete
            </button>
            <button
              className="rounded-full px-3 py-1.5 text-xs hover:bg-white/10"
              onClick={() => {
                [...selected].forEach((id) => togglePin(id));
                setSelected(new Set());
              }}
            >
              Pin
            </button>
            <button
              className="rounded-full px-2 py-1.5 text-xs text-[var(--asky-fg-muted)] hover:bg-white/10"
              onClick={() => {
                setSelected(new Set());
                setSelectMode(false);
              }}
            >
              <X size={12} />
            </button>
          </div>
        )}

        <div className="border-t border-[var(--asky-border)] px-3 py-2">
          {showClearDialog ? (
            <div className="rounded-lg border border-[var(--asky-border)] bg-[#2a2a2a] p-3 text-sm">
              <p className="mb-3">Clear all chats? Pinned chats are kept.</p>
              <div className="flex gap-2">
                <button
                  className="flex-1 rounded-full bg-white px-3 py-1.5 font-medium text-black hover:bg-gray-200"
                  onClick={() => {
                    clearConversations();
                    setShowClearDialog(false);
                  }}
                >
                  Clear
                </button>
                <button
                  className="flex-1 rounded-full px-3 py-1.5 hover:bg-white/10"
                  onClick={() => setShowClearDialog(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs text-[var(--asky-fg-muted)]">
              <span>Auto-delete 3d</span>
              <button
                className="rounded-md p-1.5 hover:bg-white/10 hover:text-[var(--asky-fg)]"
                title="Clear chat history"
                onClick={() => setShowClearDialog(true)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function ChatRow({
  chat,
  active,
  selectMode,
  checked,
  onToggleSelect,
  onOpen,
  onRename,
  onDelete,
  onPin,
  onMove,
  editing,
  setEditing,
  menuOpen,
  setMenuOpen,
}: {
  chat: ReturnType<typeof useApp>["chats"][number];
  active: boolean;
  selectMode?: boolean;
  checked?: boolean;
  onToggleSelect?: (on: boolean) => void;
  onOpen: () => void;
  onRename: (t: string) => void;
  onDelete: () => void;
  onPin: () => void;
  onMove: (folderId: string | null) => void;
  editing: boolean;
  setEditing: (v: boolean) => void;
  menuOpen: boolean;
  setMenuOpen: (v: boolean) => void;
}) {
  const { folders } = useApp();
  const [titleDraft, setTitleDraft] = useState(chat.title);
  const hoverRow = "opacity-0 group-hover:opacity-100";
  const checkbox = selectMode ? (
    <button
      className={`ml-1 rounded border p-0.5 ${
        checked ? "border-[var(--asky-accent)] bg-[var(--asky-accent)] text-white" : "border-[var(--asky-border)] text-transparent"
      } ${hoverRow}`}
      onClick={(e) => { e.stopPropagation(); onToggleSelect?.(!checked); }}
      title={checked ? "Deselect" : "Select"}
    >
      <Check size={12} />
    </button>
  ) : (
    <button
      className={`ml-1 rounded p-1 text-[var(--asky-fg-muted)] hover:bg-white/10 ${hoverRow}`}
      onClick={(e) => { e.stopPropagation(); setTitleDraft(chat.title); setEditing(true); }}
      title="Rename"
    >
      <PenLine size={12} />
    </button>
  );

  return (
    <div className={`group relative mb-0.5 flex items-center rounded-lg ${active ? "bg-[#2f2f2f]" : "hover:bg-[#2a2a2a]"}`}>
      <button
        onClick={onOpen}
        onDoubleClick={() => {
          setTitleDraft(chat.title);
          setEditing(true);
        }}
        className="flex flex-1 flex-col items-start px-2.5 py-2 text-left"
      >
        {editing ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => {
              setEditing(false);
              if (titleDraft.trim()) onRename(titleDraft.trim());
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                setEditing(false);
              }
            }}
            className="w-full bg-transparent text-sm outline-none"
          />
        ) : (
          <>
            <span className="flex items-center gap-1.5 truncate text-sm">
              <MessageSquare size={13} className="shrink-0 text-[var(--asky-fg-muted)]" />
              <span className="truncate">{chat.title}</span>
              {chat.pinned && <Pin size={11} className="shrink-0 text-[var(--asky-accent)]" />}
            </span>
            <span className="text-[11px] text-[var(--asky-fg-muted)]">
              {chat.messages.length} msgs · {timeAgo(chat.updatedAt)}
            </span>
          </>
        )}
      </button>
      {checkbox}
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className={`mr-1 rounded p-1 text-[var(--asky-fg-muted)] hover:bg-white/10 ${hoverRow}`}
      >
        <MoreVertical size={14} />
      </button>
      {menuOpen && (
        <div className="absolute right-2 top-full z-10 mt-1 w-44 overflow-hidden rounded-lg border border-[var(--asky-border)] bg-[#2a2a2a] py-1 text-sm shadow-lg">
          <button className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-white/5" onClick={() => { setMenuOpen(false); onPin(); }}>
            <Pin size={13} /> {chat.pinned ? "Unpin" : "Pin"}
          </button>
          <button className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-white/5" onClick={() => { setMenuOpen(false); setTitleDraft(chat.title); setEditing(true); }}>
            Rename
          </button>
          {folders.length > 0 && (
            <div className="border-t border-[var(--asky-border)] py-1">
              <span className="px-3 text-[11px] uppercase text-[var(--asky-fg-muted)]">Move to</span>
              <button className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-white/5" onClick={() => { setMenuOpen(false); onMove(null); }}>
                <FolderPlus size={13} /> No folder
              </button>
              {folders.map((f) => (
                <button key={f.id} className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-white/5" onClick={() => { setMenuOpen(false); onMove(f.id); }}>
                  <FolderPlus size={13} /> {f.name}
                </button>
              ))}
            </div>
          )}
          <div className="border-t border-[var(--asky-border)]">
            <button className="flex w-full items-center gap-2 px-3 py-1.5 text-red-400 hover:bg-white/5" onClick={() => { setMenuOpen(false); onDelete(); }}>
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

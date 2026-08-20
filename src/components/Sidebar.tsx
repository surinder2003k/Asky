import { useRef, useState } from "react";
import {
  Plus,
  Search,
  FolderPlus,
  Settings as SettingsIcon,
  Trash2,
  MoreVertical,
  Pin,
  MessageSquare,
  Sun,
  Moon,
  X,
  Download,
  Link as LinkIcon,
  FilePlus,
  Image,
  Info,
  Archive,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { useMemo } from "react";
import { useApp } from "../store";
import { clearConversations } from "../storage";
import { decodeShareString, parseSharedMessages, downloadMarkdown, downloadJson, downloadTxt, chatWordCount, buildShareUrl, exportChatToWhatsApp, exportAllChatsZip } from "../export";
import { exportChatToPdf } from "../pdf";
import { exportChatToWord } from "../word";
import { downloadChatPng } from "../png";

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
    renameChat,
    togglePin,
    moveChat,
    addFolder,
    renameFolder,
    deleteFolder,
    moveFolder,
    clearConversations,
    importChat,
    settings,
    setTheme,
  } = useApp();
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [shareCopied, setShareCopied] = useState(false);
  const [search, setSearch] = useState("");

  const chatMap = useMemo(() => new Map(chats.map((c) => [c.id, c])), [chats]);

  function handleShare(chatId: string) {
    const chat = chatMap.get(chatId);
    if (!chat) return;
    const url = buildShareUrl(chat);
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 1500);
      })
      .catch(() => prompt("Copy this share link:", url));
  }

  function handleExportMd(chatId: string) {
    const chat = chatMap.get(chatId);
    if (chat) downloadMarkdown(chat);
  }

  function handleExportJson(chatId: string) {
    const chat = chatMap.get(chatId);
    if (chat) downloadJson(chat);
  }

  function handleExportPdf(chatId: string) {
    const chat = chatMap.get(chatId);
    if (chat) exportChatToPdf(chat);
  }
  function handleExportWord(chatId: string) {
    const chat = chatMap.get(chatId);
    if (chat) exportChatToWord(chat);
  }

  function handleExportPng(chatId: string) {
    const chat = chatMap.get(chatId);
    if (chat) downloadChatPng(chat);
  }
  function handleExportTxt(chatId: string) {
    const chat = chatMap.get(chatId);
    if (chat) downloadTxt(chat);
  }
  function handleExportWhatsApp(chatId: string) {
    const chat = chatMap.get(chatId);
    if (chat) exportChatToWhatsApp(chat);
  }
  function handleInfo(chatId: string) {
    const chat = chatMap.get(chatId);
    if (!chat) return;
    const { words, tokens } = chatWordCount(chat);
    prompt(
      `Chat info — ${chat.title}\n\nMessages: ${chat.messages.length}\nWords: ${words.toLocaleString()}\nApprox tokens: ${tokens.toLocaleString()}`,
      "",
    );
  }
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const pendingDeleteChat = pendingDelete ? chats.find((c) => c.id === pendingDelete) : undefined;

  function deleteChatDirect(chatId: string) {
    deleteChat(chatId);
  }

  function confirmDeleteChat(chatId: string) {
    setMenuFor(null);
    setPendingDelete(chatId);
  }

  function runPendingDelete() {
    if (!pendingDelete) return;
    const id = pendingDelete;
    setPendingDelete(null);
    deleteChat(id);
  }

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
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[var(--asky-bg)] transition-transform duration-200 lg:static lg:translate-x-0 lg:z-auto ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-3 pt-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => addFolder(prompt("Folder name?") || "New Folder")}
              className="rounded-md p-2 text-[var(--asky-fg-muted)] hover:bg-[var(--asky-hover)] hover:text-[var(--asky-fg)]"
              title="New folder"
            >
              <Plus size={18} />
            </button>
            <span className="text-lg font-semibold">Asky</span>
          </div>
          <button
            onClick={() => setTheme(settings.theme === "dark" ? "light" : "dark")}
            className="rounded-md p-2 text-[var(--asky-fg-muted)] hover:bg-[var(--asky-hover)] hover:text-[var(--asky-fg)]"
            title={`Switch to ${settings.theme === "dark" ? "light" : "dark"} mode`}
          >
            {settings.theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            onClick={onOpenSettings}
            className="rounded-md p-2 text-[var(--asky-fg-muted)] hover:bg-[var(--asky-hover)] hover:text-[var(--asky-fg)]"
            title="Settings"
          >
            <SettingsIcon size={18} />
          </button>
          <button onClick={onClose} className="rounded-md p-2 text-[var(--asky-fg-muted)] lg:hidden">
            <X size={18} />
          </button>
        </div>

        <div className="px-3 pt-3">
          <button
            onClick={() => createChat()}
            className="flex w-full items-center gap-2 rounded-xl border border-[var(--asky-border)] px-3 py-2.5 text-sm font-medium hover:bg-[var(--asky-hover)]"
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
              className="w-full rounded-xl border border-[var(--asky-border)] bg-[var(--asky-bg-input)] py-2 pl-8 pr-3 text-sm outline-none focus:border-[var(--asky-accent)]"
            />
          </div>
        </div>

        <nav className="mt-3 flex-1 overflow-y-auto px-2">
          {folders.map((f) => {
            const inFolder = filtered.filter((c) => c.folderId === f.id);
            return (
              <div key={f.id} className="mb-1">
                <div className="group flex items-center gap-1 rounded-lg px-2 py-1.5">
                  <span className="truncate text-xs font-semibold uppercase tracking-wide text-[var(--asky-fg-muted)]">
                    {f.name}
                  </span>
                  <button
                    className="ml-auto hidden rounded p-1 hover:bg-[var(--asky-hover2)] group-hover:block"
                    onClick={() => {
                      const name = prompt("Rename folder", f.name);
                      if (name) renameFolder(f.id, name);
                    }}
                  >
                    <MoreVertical size={12} />
                  </button>
                  <button
                    className="hidden rounded p-1 text-[var(--asky-fg-muted)] hover:bg-[var(--asky-hover2)] group-hover:block"
                    onClick={() => confirm(`Delete folder "${f.name}"? Chats move to Recent.`) && deleteFolder(f.id)}
                    title="Delete folder"
                  >
                    <Trash2 size={12} />
                  </button>
                  <button
                    className="hidden rounded p-1 text-[var(--asky-fg-muted)] hover:bg-[var(--asky-hover2)] group-hover:block"
                    onClick={() => moveFolder(f.id, -1)}
                    title="Move folder up"
                  >
                    <ChevronUp size={12} />
                  </button>
                  <button
                    className="hidden rounded p-1 text-[var(--asky-fg-muted)] hover:bg-[var(--asky-hover2)] group-hover:block"
                    onClick={() => moveFolder(f.id, 1)}
                    title="Move folder down"
                  >
                    <ChevronDown size={12} />
                  </button>
                </div>
                {inFolder.map((c) => (
                  <ChatRow
                    key={c.id}
                    chat={c}
                    active={c.id === activeChatId}
                    onOpen={() => {
                      setActiveChatId(c.id);
                      setMenuFor(null);
                      onClose();
                    }}
                    onRename={(t) => renameChat(c.id, t)}
                    onDelete={() => confirmDeleteChat(c.id)}
                    onPin={() => togglePin(c.id)}
                    onMove={() => moveChat(c.id, null)}
                    editing={editingTitle === c.id}
                    setEditing={(v) => setEditingTitle(v ? c.id : null)}
                    menuOpen={menuFor === c.id}
                    setMenuOpen={(v) => setMenuFor(v ? c.id : null)}
                    onExportMd={() => handleExportMd(c.id)}
                    onExportJson={() => handleExportJson(c.id)}
                    onExportPdf={() => handleExportPdf(c.id)}
                    onExportWord={() => handleExportWord(c.id)}
                    onExportPng={() => handleExportPng(c.id)}
                    onExportTxt={() => handleExportTxt(c.id)}
                    onExportWhatsApp={() => handleExportWhatsApp(c.id)}
                    onInfo={() => handleInfo(c.id)}
                    onShare={() => handleShare(c.id)}
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
                    onOpen={() => {
                      setActiveChatId(c.id);
                      setMenuFor(null);
                      onClose();
                    }}
                    onRename={(t) => renameChat(c.id, t)}
                    onDelete={() => confirmDeleteChat(c.id)}
                    onPin={() => togglePin(c.id)}
                    onMove={(f) => moveChat(c.id, f)}
                    editing={editingTitle === c.id}
                    setEditing={(v) => setEditingTitle(v ? c.id : null)}
                    menuOpen={menuFor === c.id}
                    setMenuOpen={(v) => setMenuFor(v ? c.id : null)}
                    onExportMd={() => handleExportMd(c.id)}
                    onExportJson={() => handleExportJson(c.id)}
                    onExportPdf={() => handleExportPdf(c.id)}
                    onExportWord={() => handleExportWord(c.id)}
                    onExportPng={() => handleExportPng(c.id)}
                    onExportTxt={() => handleExportTxt(c.id)}
                    onExportWhatsApp={() => handleExportWhatsApp(c.id)}
                    onInfo={() => handleInfo(c.id)}
                    onShare={() => handleShare(c.id)}
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
                    onOpen={() => {
                      setActiveChatId(c.id);
                      setMenuFor(null);
                      onClose();
                    }}
                    onRename={(t) => renameChat(c.id, t)}
                    onDelete={() => confirmDeleteChat(c.id)}
                    onPin={() => togglePin(c.id)}
                    onMove={(f) => moveChat(c.id, f)}
                    editing={editingTitle === c.id}
                    setEditing={(v) => setEditingTitle(v ? c.id : null)}
                    menuOpen={menuFor === c.id}
                    setMenuOpen={(v) => setMenuFor(v ? c.id : null)}
                    onExportMd={() => handleExportMd(c.id)}
                    onExportJson={() => handleExportJson(c.id)}
                    onExportPdf={() => handleExportPdf(c.id)}
                    onExportWord={() => handleExportWord(c.id)}
                    onExportPng={() => handleExportPng(c.id)}
                    onExportTxt={() => handleExportTxt(c.id)}
                    onExportWhatsApp={() => handleExportWhatsApp(c.id)}
                    onInfo={() => handleInfo(c.id)}
                    onShare={() => handleShare(c.id)}
                  />
                ))}
            </div>
          )}

          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-[var(--asky-fg-muted)]">
              {q ? "No chats match your search." : "No chats yet.\nChats auto-delete after 5 days (pinned chats are kept)."}
            </p>
          )}
        </nav>

        <div className="border-t border-[var(--asky-border)] px-3 py-2">
          {showClearDialog ? (
            <div className="rounded-lg border border-[var(--asky-border)] bg-[var(--asky-bg-input)] p-3 text-sm">
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
                  className="flex-1 rounded-full px-3 py-1.5 hover:bg-[var(--asky-hover2)]"
                  onClick={() => setShowClearDialog(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs text-[var(--asky-fg-muted)]">
              <span>Auto-delete 5d</span>
              <div className="flex gap-1">
                <button
                  className="rounded-md p-1.5 hover:bg-[var(--asky-hover2)] hover:text-[var(--asky-fg)]"
                  title="Save current chat as PNG image"
                  onClick={() => {
                    const cur = chats.find((c) => c.id === activeChatId);
                    if (cur) downloadChatPng(cur);
                  }}
                >
                  <Image size={14} />
                </button>
                <button
                  className="rounded-md p-1.5 hover:bg-[var(--asky-hover2)] hover:text-[var(--asky-fg)]"
                  title="Export all chats as zip"
                  onClick={() => exportAllChatsZip(chats.filter((c) => !c.pinned).length > 0 ? chats : chats)}
                >
                  <Archive size={14} />
                </button>
                <button
                  className="rounded-md p-1.5 hover:bg-[var(--asky-hover2)] hover:text-[var(--asky-fg)]"
                  title="Import chat"
                  onClick={() => { setImportText(""); setShowImport((v) => !v); }}
                >
                  <FilePlus size={14} />
                </button>
                <button
                  className="rounded-md p-1.5 hover:bg-[var(--asky-hover2)] hover:text-[var(--asky-fg)]"
                  title="Clear chat history"
                  onClick={() => setShowClearDialog(true)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )}
          {showImport && (
            <div className="mt-2 rounded-lg border border-[var(--asky-border)] bg-[var(--asky-bg-input)] p-3 text-sm">
              <p className="mb-2 text-xs text-[var(--asky-fg-muted)]">
                Paste a shared Asky link or chat JSON, then open it as a new chat.
              </p>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="https://...?share=... or { ... }"
                rows={3}
                className="w-full rounded-md bg-[var(--asky-bg)] p-2 text-xs outline-none focus:ring-1 focus:ring-[var(--asky-accent)]"
              />
              <div className="mt-2 flex gap-2">
                <button
                  className="flex-1 rounded-full bg-white px-3 py-1.5 font-medium text-black hover:bg-gray-200"
                  onClick={() => {
                    importAsChat(importText.trim(), importChat);
                    setShowImport(false);
                  }}
                >
                  Import
                </button>
                <button
                  className="flex-1 rounded-full px-3 py-1.5 hover:bg-[var(--asky-hover2)]"
                  onClick={() => setShowImport(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {pendingDeleteChat && (
        <DeleteConfirmDialog
          title={pendingDeleteChat.title}
          onCancel={() => setPendingDelete(null)}
          onConfirm={runPendingDelete}
        />
      )}
    </>
  );
}

function importAsChat(raw: string, importChat: ReturnType<typeof useApp>["importChat"]) {
  if (!raw) return;
  let input = raw;
  const m = raw.match(/[?&]share=([^&]+)/);
  if (m) input = m[1];
  const hash = raw.match(/#\/?(share\?c=|share=)([^&]+)/);
  if (!m && hash) input = hash[2];
  try {
    const json = decodeShareString(input);
    const parsed = parseSharedMessages(json);
    importChat(parsed.messages, parsed.title, parsed.modelKey);
  } catch {
    alert("Couldn't import: not a valid Asky chat link or JSON.");
  }
}

function ChatRow({
  chat,
  active,
  onOpen,
  onRename,
  onDelete,
  onPin,
  onMove,
  editing,
  setEditing,
  menuOpen,
  setMenuOpen,
  onExportMd,
  onExportJson,
  onExportPdf,
  onExportWord,
  onExportPng,
  onExportTxt,
  onExportWhatsApp,
  onInfo,
  onShare,
}: {
  chat: ReturnType<typeof useApp>["chats"][number];
  active: boolean;
  onOpen: () => void;
  onRename: (t: string) => void;
  onDelete: () => void;
  onPin: () => void;
  onMove: (folderId: string | null) => void;
  editing: boolean;
  setEditing: (v: boolean) => void;
  menuOpen: boolean;
  setMenuOpen: (v: boolean) => void;
  onExportMd: () => void;
  onExportJson: () => void;
  onExportPdf: () => void;
  onExportWord: () => void;
  onExportPng: () => void;
  onExportTxt: () => void;
  onExportWhatsApp: () => void;
  onInfo: () => void;
  onShare: () => void;
}) {
  const { folders } = useApp();
  const [titleDraft, setTitleDraft] = useState(chat.title);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);
  const swipeState = useRef<{ startX: number; startY: number; active: boolean }>({ startX: 0, startY: 0, active: true });

  function onTouchStartSwipe(e: React.TouchEvent) {
    swipeState.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, active: true };
  }

  function onTouchEndSwipe(e: React.TouchEvent) {
    if (!swipeState.current.active) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const dx = endX - swipeState.current.startX;
    const dy = endY - swipeState.current.startY;
    // Require a mostly-horizontal swipe of at least 70px
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 2) {
      if (dx < 0) {
        // swipe left -> delete (goes through confirm dialog)
        onDelete();
      } else {
        // swipe right -> open
        onOpen();
      }
      // swallow the pending click from long-press handling
      didLongPress.current = true;
      setTimeout(() => setMenuOpen(false), 0);
    }
    swipeState.current.active = false;
  }

  function startLongPress() {
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      setMenuOpen(true);
    }, 450);
  }

  function endLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  return (
    <div className={`group relative mb-0.5 flex items-center rounded-lg ${active ? "bg-[var(--asky-bg-elev)]" : "hover:bg-[var(--asky-bg-input)]"}`}>
      <button
        onClick={onOpen}
        onDoubleClick={() => {
          setTitleDraft(chat.title);
          setEditing(true);
        }}
        onMouseDown={startLongPress}
        onMouseUp={endLongPress}
        onMouseLeave={endLongPress}
        onTouchStart={(e) => {
          startLongPress();
          onTouchStartSwipe(e);
        }}
        onTouchEnd={(e) => {
          endLongPress();
          // prevent the pending click from firing after a long press
          if (didLongPress.current) {
            didLongPress.current = false;
            setTimeout(() => setMenuOpen(false), 0);
            return;
          }
          onTouchEndSwipe(e);
        }}
        onTouchMove={(e) => {
          // a big vertical move (scroll) cancels swipe detection
          const dy = Math.abs(e.touches[0].clientY - swipeState.current.startY);
          if (dy > 30) swipeState.current.active = false;
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenuOpen(true);
        }}
        className="flex min-w-0 flex-1 flex-col items-start gap-0 px-2.5 py-2 text-left"
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
            <span className="flex w-full min-w-0 items-center gap-1.5">
              <MessageSquare size={13} className="shrink-0 text-[var(--asky-fg-muted)]" />
              <span className="min-w-0 flex-1 truncate text-sm">{chat.title}</span>
              {chat.pinned && <Pin size={11} className="shrink-0 text-[var(--asky-accent)]" />}
            </span>
            {(() => {
              const last = [...chat.messages].reverse().find((x) => x.role === "assistant" && x.content && !x.error);
              if (!last) return null;
              return (
                <span className="mt-0.5 block w-full truncate text-[11px] leading-tight text-[var(--asky-fg-muted)]" title={last.content}>
                  {last.content.slice(0, 60).replace(/\n/g, " ")}
                </span>
              );
            })()}
            <span
              className="text-[11px] text-[var(--asky-fg-muted)]"
              title={new Date(chat.updatedAt).toLocaleString()}
            >
              {chat.messages.length} msgs · {timeAgo(chat.updatedAt)}
            </span>
          </>
        )}
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen(false);
          onDelete();
        }}
        aria-label={`Delete ${chat.title}`}
        className="mr-1 rounded p-1 text-[var(--asky-fg-muted)] opacity-100 hover:bg-red-500/15 hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100"
      >
        <Trash2 size={14} />
      </button>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="mr-1 rounded p-1 text-[var(--asky-fg-muted)] opacity-0 hover:bg-[var(--asky-hover2)] group-hover:opacity-100"
      >
        <MoreVertical size={14} />
      </button>
      {menuOpen && (
        <div className="absolute right-2 top-full z-10 mt-1 w-44 overflow-hidden rounded-lg border border-[var(--asky-border)] bg-[var(--asky-bg-input)] py-1 text-sm shadow-lg">
          <button className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-[var(--asky-hover)]" onClick={() => { setMenuOpen(false); onPin(); }}>
            <Pin size={13} /> {chat.pinned ? "Unpin" : "Pin"}
          </button>
          <button className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-[var(--asky-hover)]" onClick={() => { setMenuOpen(false); setTitleDraft(chat.title); setEditing(true); }}>
            Rename
          </button>
          {folders.length > 0 && (
            <div className="border-t border-[var(--asky-border)] py-1">
              <span className="px-3 text-[11px] uppercase text-[var(--asky-fg-muted)]">Move to</span>
              <button className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-[var(--asky-hover)]" onClick={() => { setMenuOpen(false); onMove(null); }}>
                <FolderPlus size={13} /> No folder
              </button>
              {folders.map((f) => (
                <button key={f.id} className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-[var(--asky-hover)]" onClick={() => { setMenuOpen(false); onMove(f.id); }}>
                  <FolderPlus size={13} /> {f.name}
                </button>
              ))}
            </div>
          )}
          <div className="border-t border-[var(--asky-border)]">
            <button className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-[var(--asky-hover)]" onClick={() => { setMenuOpen(false); onExportMd(); }}>
              <Download size={13} /> Export .md
            </button>
            <button className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-[var(--asky-hover)]" onClick={() => { setMenuOpen(false); onExportJson(); }}>
              <FilePlus size={13} /> Export .json
            </button>
            <button className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-[var(--asky-hover)]" onClick={() => { setMenuOpen(false); onShare(); }}>
              <LinkIcon size={13} /> Copy share link
            </button>
            <button className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-[var(--asky-hover)]" onClick={() => { setMenuOpen(false); onExportPdf(); }}>
              <Download size={13} /> Export .pdf
            </button>
            <button className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-[var(--asky-hover)]" onClick={() => { setMenuOpen(false); onExportWord(); }}>
              <Download size={13} /> Export .docx
            </button>
            <button className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-[var(--asky-hover)]" onClick={() => { setMenuOpen(false); onExportPng(); }}>
              <Image size={13} /> Export .png
            </button>
            <button className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-[var(--asky-hover)]" onClick={() => { setMenuOpen(false); onExportWhatsApp(); }}>
              <LinkIcon size={13} /> Export for WhatsApp
            </button>
            <button className="flex w-full items-center gap-2 px-3 py-1.5 text-red-400 hover:bg-[var(--asky-hover)]" onClick={() => { setMenuOpen(false); onDelete(); }}>
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DeleteConfirmDialog({
  title,
  onCancel,
  onConfirm,
}: {
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-6">
      <div className="w-full max-w-sm rounded-xl border border-[var(--asky-border)] bg-[var(--asky-bg-input)] p-5 shadow-xl">
        <h3 className="text-[15px] font-semibold text-[var(--asky-fg)]">Delete chat</h3>
        <p className="mt-2 text-sm text-[var(--asky-fg-muted)]">
          Delete <span className="font-medium text-[var(--asky-fg)]">{title}</span>? This cannot be undone.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg px-3.5 py-2 text-sm text-[var(--asky-fg-muted)] hover:bg-[var(--asky-hover2)]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-red-500 px-3.5 py-2 text-sm font-medium text-white hover:bg-red-600"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

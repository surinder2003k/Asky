import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { PanelLeft } from "lucide-react";
import { decodeShareString, parseSharedMessages } from "./export";
import { KEY_CHATS, KEY_FOLDERS, KEY_SETTINGS } from "./storage";
import { AppProvider, useApp } from "./store";
import Sidebar from "./components/Sidebar";
import ChatScreen from "./components/ChatScreen";
import SettingsModal from "./components/SettingsModal";
import PinScreen from "./components/PinScreen";
import OfflineNotice, { useIsOffline } from "./components/OfflineNotice";
import LandingPage from "./components/LandingPage";
import { isLoggedIn, logout } from "./auth";
/**
 * Catches any render-time crash and shows a friendly recovery screen instead
 * of a blank page. Also offers clearing corrupted storage state, which is a
 * common cause of the "page turns blank while chatting" bug.
 */
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null; confirmClear: boolean }
> {
  state = { error: null as Error | null, confirmClear: false };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error("[Asky] render crash:", error);
  }
  private downloadChatsBackup = () => {
    try {
      const raw = localStorage.getItem(KEY_CHATS) || "[]";
      const blob = new Blob([raw], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `asky-chats-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      /* ignore */
    }
  };

  private clearAll = () => {
    [KEY_CHATS, KEY_FOLDERS, KEY_SETTINGS, "asky.status"].forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {
        /* ignore */
      }
    });
    window.location.reload();
  };

  private renderClearConfirm() {
    return (
      <div className="rounded-xl border border-[var(--asky-border)] bg-[var(--asky-bg-input)] p-4 text-left">
        <div className="text-sm font-medium text-[var(--asky-warning)]">⚠ This deletes EVERYTHING</div>
        <p className="mt-1 text-xs text-[var(--asky-fg-muted)]">
          All chats, folders, themes and API key settings on this device will be erased permanently.
          This only helps if the stored data itself is corrupted.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            onClick={() => {
              this.downloadChatsBackup();
              this.clearAll();
            }}
            className="rounded-lg bg-[var(--asky-error)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
          >
            Download backup of chats, then erase & reload
          </button>
          <button
            onClick={this.clearAll}
            className="rounded-lg border border-[var(--asky-error)] px-3 py-1.5 text-xs text-[var(--asky-error)] hover:bg-[var(--asky-error)]/10"
          >
            Erase everything & reload (no backup)
          </button>
          <button
            onClick={() => this.setState({ confirmClear: false })}
            className="rounded-lg border border-[var(--asky-border)] px-3 py-1.5 text-xs text-[var(--asky-fg-muted)] hover:bg-[var(--asky-hover)]"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[var(--asky-bg)] p-6 text-center">
          <div className="text-2xl">😵</div>
          <h1 className="text-lg font-semibold text-[var(--asky-fg)]">Something went wrong</h1>
          <p className="max-w-sm text-sm text-[var(--asky-fg-muted)]">
            The page crashed unexpectedly (this can happen after a failed save or a corrupted cache).
            Try recovering below — your chats are stored on this device.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg bg-[var(--asky-accent)] px-4 py-2 text-sm font-medium text-white"
            >
              Reload page
            </button>
            <button
              onClick={() => this.downloadChatsBackup()}
              className="rounded-lg border border-[var(--asky-border)] px-4 py-2 text-sm text-[var(--asky-fg-muted)] hover:bg-[var(--asky-hover)]"
              title="Save a JSON copy of your chats before doing anything else"
            >
              Download chat backup first
            </button>
            <button
              onClick={() => this.setState({ confirmClear: !this.state.confirmClear })}
              className="rounded-lg border border-[var(--asky-border)] px-4 py-2 text-sm text-[var(--asky-fg-muted)] hover:bg-[var(--asky-hover)]"
            >
              Clear corrupted data & reload
            </button>
          </div>
          {this.state.confirmClear ? this.renderClearConfirm() : null}
          <details className="w-full max-w-md text-left">
            <summary className="cursor-pointer text-xs text-[var(--asky-fg-muted)]">Technical details</summary>
            <pre className="mt-2 max-h-40 overflow-auto rounded-lg border border-[var(--asky-border)] bg-[var(--asky-bg-input)] p-3 text-[11px] text-[var(--asky-fg-muted)]">
              {this.state.error?.message}
              {"\n"}
              {this.state.error?.stack?.slice(0, 800)}
            </pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}
function Shell() {
  const { settings, importChat, newChat, isLoaded } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [unlocked, setUnlocked] = useState(!settings.pinEnabled);
  const [authed, setAuthed] = useState(isLoggedIn());
  const shareHandled = useRef(false);

  // Hydrate a shared chat from ?share= (or #share=) URL parameter on first load.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hashShare = window.location.hash.replace(/^#\/?(share\?c=|share=)/, "");
    const raw = params.get("share") || hashShare;
    if (!raw || shareHandled.current) return;
    shareHandled.current = true;
    try {
      const json = decodeShareString(raw);
      const parsed = parseSharedMessages(json);
      if (parsed.messages.length > 0) {
        importChat(parsed.messages, parsed.title, parsed.modelKey);
      }
    } catch {
      /* invalid link — fall through to a normal new chat */
    }
    window.history.replaceState(null, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, importChat]);

  // Keyboard shortcuts: Ctrl+K new chat, Ctrl+/ focus composer, Esc close overlays.
  useEffect(() => {
    if (!isLoaded) return;
    function onKey(e: KeyboardEvent) {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSettingsOpen(false);
        setSidebarOpen(false);
        newChat();
        return;
      }
      if (ctrl && e.key === "/") {
        e.preventDefault();
        setSettingsOpen(false);
        const ta = document.querySelector<HTMLTextAreaElement>('textarea[placeholder="Message Asky"]');
        ta?.focus();
        return;
      }
      if (e.key === "Escape") {
        if (settingsOpen) {
          setSettingsOpen(false);
          return;
        }
        if (sidebarOpen) setSidebarOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isLoaded, newChat, settingsOpen, sidebarOpen]);

  if (useIsOffline()) {
    return <OfflineNotice />;
  }

  if (!authed) {
    return (
      <LandingPage
        onLoggedIn={() => setAuthed(true)}
      />
    );
  }

  if (settings.pinEnabled && !unlocked) {
    return <PinScreen pinHash={settings.pinHash!} onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <div className="flex h-full">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <main className="relative flex min-w-0 flex-1 flex-col">
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className="absolute left-3 top-3 z-30 rounded-md p-2 text-[var(--asky-fg-muted)] hover:bg-[var(--asky-hover)] lg:hidden"
          title="Open sidebar"
        >
          <PanelLeft size={20} />
        </button>
        <ChatScreen
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          onOpenSettings={() => setSettingsOpen(true)}
          onLogout={() => {
            logout();
            setAuthed(false);
          }}
        />
      </main>
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} onLogout={() => { logout(); setAuthed(false); setSettingsOpen(false); }} />}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <Shell />
      </AppProvider>
    </ErrorBoundary>
  );
}

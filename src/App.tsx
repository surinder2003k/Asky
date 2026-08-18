import { useEffect, useRef, useState } from "react";
import { PanelLeft } from "lucide-react";
import { decodeShareString, parseSharedMessages } from "./export";
import { AppProvider, useApp } from "./store";
import Sidebar from "./components/Sidebar";
import ChatScreen from "./components/ChatScreen";
import SettingsModal from "./components/SettingsModal";
import PinScreen from "./components/PinScreen";
import OfflineNotice, { useIsOffline } from "./components/OfflineNotice";

function Shell() {
  const { settings, importChat, newChat, isLoaded } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [unlocked, setUnlocked] = useState(!settings.pinEnabled);
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
      <main className="relative flex flex-1 flex-col">
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
        />
      </main>
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}

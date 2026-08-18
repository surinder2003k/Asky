import { useState } from "react";
import { PanelLeft } from "lucide-react";
import { AppProvider, useApp } from "./store";
import Sidebar from "./components/Sidebar";
import ChatScreen from "./components/ChatScreen";
import SettingsModal from "./components/SettingsModal";
import PinScreen from "./components/PinScreen";
import OfflineNotice, { useIsOffline } from "./components/OfflineNotice";

function Shell() {
  const { settings, createChat, activeChatId } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [unlocked, setUnlocked] = useState(!settings.pinEnabled);

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
          className="absolute left-3 top-3 z-30 rounded-md p-2 text-[var(--asky-fg-muted)] hover:bg-white/5 lg:hidden"
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

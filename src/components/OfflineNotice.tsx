import { useEffect, useState } from "react";
import { WifiOff, RefreshCw } from "lucide-react";

/**
 * Global network guard.
 * - Offline: shows a slim non-blocking top banner (instead of a full-screen page)
 *   so saved chats can still be read locally; new AI replies need a connection.
 * - Back online: banner disappears automatically.
 * Works with or without a real service worker — navigator.onLine is the trigger.
 */
export function useIsOffline(): boolean {
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return offline;
}

export default function OfflineNotice() {
  const offline = useIsOffline();
  if (!offline) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex justify-center p-3">
      <div className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-[var(--asky-border)] bg-[var(--asky-bg-elev)] px-4 py-2 shadow-xl">
        <WifiOff size={15} className="text-[var(--asky-fg-muted)]" />
        <p className="text-[13px] text-[var(--asky-fg-muted)]">
          No internet — saved chats can still be read. AI replies need a connection.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[13px] text-[var(--asky-fg)] hover:bg-white/10"
        >
          <RefreshCw size={13} />
          Retry
        </button>
      </div>
    </div>
  );
}

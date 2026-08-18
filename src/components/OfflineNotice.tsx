import { useEffect, useState } from "react";
import { WifiOff, RefreshCw } from "lucide-react";

/**
 * Global network guard.
 * - Fully offline: shows a friendly "No Internet" page (instead of broken API errors).
 * - Back online: returns to normal app automatically.
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
    <div className="flex h-full w-full items-center justify-center bg-[var(--asky-bg)] p-6">
      <div className="w-full max-w-sm rounded-xl border border-[var(--asky-border)] bg-[var(--asky-surface)] p-8 text-center shadow-xl">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--asky-fg-muted)]/10">
          <WifiOff size={28} className="text-[var(--asky-fg-muted)]" />
        </div>
        <h1 className="mb-2 text-xl font-semibold text-[var(--asky-fg)]">No internet connection</h1>
        <p className="mb-6 text-sm leading-relaxed text-[var(--asky-fg-muted)]">
          Asky needs an active internet connection to chat with AI. Your saved chats are safe on
          this device and will reappear when you come back online.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--asky-primary)] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          <RefreshCw size={16} />
          Try again
        </button>
      </div>
    </div>
  );
}

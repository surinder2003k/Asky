import { useEffect, useRef, useState } from "react";
import { Download, X, Smartphone } from "lucide-react";

/*
 * PWA "Add to Home Screen" prompt.
 * - Chromium (Android/ChromeOS/Desktop): listens for the `beforeinstallprompt`
 *   event, saves it, and shows an install banner button. Tapping calls prompt()
 *   then userChromePrompt.userChoice.
 * - iOS Safari: no beforeinstallprompt event exists; we detect iOS + Safari and
 *   show a native-instructions chip instead (Share -> Add to Home Screen).
 * - Already-installed (standalone / fullscreen display mode) => nothing shown.
 * - Dismiss is remembered in localStorage (7 days), unless a newer app version
 *   bumps the stored key.
 */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

const DISMISS_KEY = "asky.installDismissed.v1";
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function isInstalled(): boolean {
  if (typeof window.matchMedia === "undefined") return false;
  // Standalone PWA or fullscreen display means it's already installed.
  const standalone =
    "standalone" in window.navigator && (window.navigator as any).standalone === true;
  const mq = window.matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches;
  return standalone || mq;
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
}

function isSafariOnIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return isIOS() && /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(navigator.userAgent);
}

function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const { at } = JSON.parse(raw) as { at: number };
    return Date.now() - at < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

function dismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify({ at: Date.now() }));
  } catch {
    /* ignore */
  }
}

export default function InstallPrompt() {
  const [canPrompt, setCanPrompt] = useState(false);
  const [showIOS, setShowIOS] = useState(false);
  const promptEvent = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isInstalled()) return; // already an app — nothing to show
    if (isSafariOnIOS() && !isDismissed()) {
      setShowIOS(true);
      return;
    }
    // Chromium: capture beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      promptEvent.current = e as BeforeInstallPromptEvent;
      if (!isDismissed()) setCanPrompt(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    const evt = promptEvent.current;
    if (!evt) return;
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    setCanPrompt(false);
    if (outcome === "dismissed") dismiss();
    promptEvent.current = null;
  };

  const handleDismiss = () => {
    setCanPrompt(false);
    setShowIOS(false);
    dismiss();
  };

  if (!canPrompt && !showIOS) return null;

  return (
    <div className="mx-auto mb-3 flex w-[calc(100%-1.5rem)] max-w-2xl items-center gap-2 rounded-xl border border-[var(--asky-border)] bg-[var(--asky-surface)] px-3 py-2.5 shadow-sm">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--asky-accent)]/15 text-[var(--asky-accent)]">
        {showIOS ? <Smartphone size={16} /> : <Download size={16} />}
      </div>
      <p className="min-w-0 flex-1 text-[12px] leading-snug text-[var(--asky-fg)]">
        {showIOS ? (
          <>
            Install Asky as an app: tap <strong>Share</strong> (box with arrow), then{" "}
            <strong>Add to Home Screen</strong>.
          </>
        ) : (
          <>Install Asky as an app on this device — open it from your home screen like any other app.</>
        )}
      </p>
      {!showIOS && (
        <button
          onClick={handleInstall}
          className="shrink-0 rounded-lg bg-[var(--asky-accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
        >
          Install
        </button>
      )}
      <button
        onClick={handleDismiss}
        className="shrink-0 rounded-md p-1.5 text-[var(--asky-fg-muted)] hover:bg-[var(--asky-hover)] hover:text-[var(--asky-fg)]"
        title="Hide this suggestion"
      >
        <X size={14} />
      </button>
    </div>
  );
}

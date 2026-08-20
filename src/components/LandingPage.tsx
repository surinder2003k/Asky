import { Sparkles, MessageSquare, Image as ImageIcon, Code2, Lock, Smartphone, Sun, Moon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { tryLogin, type LoginAttempt } from "../auth";

interface Props {
  onLoggedIn: () => void;
}

const FEATURES: { icon: typeof Sparkles; title: string; desc: string }[] = [
  { icon: MessageSquare, title: "20+ free AI models", desc: "Chat with Nvidia, Groq, Gemini, OpenRouter and more — pick any model per chat." },
  { icon: ImageIcon, title: "Image analysis", desc: "Attach an image and vision models analyze it right inside the chat." },
  { icon: Code2, title: "Code & previews", desc: "HTML previews, copy buttons and clean code blocks, just like ChatGPT." },
  { icon: Lock, title: "100% private", desc: "Everything stays on your device. No accounts, no tracking, no cookies." },
  { icon: Smartphone, title: "Works like an app", desc: "Install to your home screen and it opens full-screen like a native app." },
  { icon: Sparkles, title: "Your keys, your control", desc: "Bring your own free API keys in settings — no vendor lock-in." },
];

export default function LandingPage({ onLoggedIn }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme] = useState<"dark" | "light">(() => loadTheme());
  const focusRef = useRef<HTMLInputElement>(null);

  function loadTheme(): "dark" | "light" {
    try {
      const s = JSON.parse(localStorage.getItem("asky.settings") || "{}");
      return s.theme === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  }

  useEffect(() => {
    focusRef.current?.focus();
  }, []);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (loading) return;
      if (!username.trim() || !password) {
        setError("Please enter your username and password.");
        return;
      }
      setLoading(true);
      setError(null);
      // Small artificial delay so the button clearly shows it is working.
      const [attempt] = await Promise.all([tryLogin(username, password), new Promise((r) => setTimeout(r, 450))]);
      setLoading(false);
      if ((attempt as LoginAttempt).ok) {
        onLoggedIn();
      } else {
        // Never reveal whether the username or password was wrong.
        setError("Incorrect username or password. Please try again.");
        setPassword("");
      }
    },
    [username, password, loading, onLoggedIn],
  );

  return (
    <div
      data-theme={theme}
      className="min-h-dvh w-full"
      style={{ background: "var(--asky-bg)", color: "var(--asky-fg)" }}
    >
      {/* Header */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <img src="/icon-192.png" alt="Asky" className="h-8 w-8 rounded-lg" />
          <span className="text-lg font-semibold" style={{ color: "var(--asky-fg)" }}>Asky</span>
        </div>
        <span className="rounded-full border px-3 py-1 text-xs" style={{ borderColor: "var(--asky-border)", color: "var(--asky-fg-muted)" }}>
          Private AI chat
        </span>
      </header>

      <div className="mx-auto grid max-w-5xl gap-10 px-5 pb-16 pt-6 lg:grid-cols-2 lg:pt-12">
        {/* Left: intro + features */}
        <section>
          <div
            className="mb-6 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
            style={{ background: "var(--asky-accent-soft)", color: "var(--asky-accent)" }}
          >
            <Sparkles size={12} /> Your personal AI assistant
          </div>
          <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
            Chat with AI.<br />Stay completely private.
          </h1>
          <p className="mt-4 max-w-md text-base" style={{ color: "var(--asky-fg-muted)" }}>
            Asky is a minimal, ChatGPT-style chat site with 20+ free models from
            Nvidia, Groq, Gemini and more. Your chats, keys and settings live only
            on your device — nothing is tracked or sent anywhere else.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border p-4"
                style={{ background: "var(--asky-bg-elev)", borderColor: "var(--asky-border)" }}
              >
                <f.icon size={18} style={{ color: "var(--asky-accent)" }} />
                <div className="mt-2 text-sm font-semibold">{f.title}</div>
                <div className="mt-1 text-xs leading-relaxed" style={{ color: "var(--asky-fg-muted)" }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Right: login card */}
        <section className="lg:pt-6">
          <div
            className="mx-auto w-full max-w-sm rounded-2xl border p-6 shadow-xl"
            style={{ background: "var(--asky-bg-elev)", borderColor: "var(--asky-border)" }}
          >
            <div className="flex justify-center">
              <img src="/icon-192.png" alt="Asky" className="h-14 w-14 rounded-2xl" />
            </div>
            <h2 className="mt-4 text-center text-xl font-semibold">Welcome back</h2>
            <p className="mt-1 text-center text-xs" style={{ color: "var(--asky-fg-muted)" }}>
              Sign in to open Asky
            </p>

            <form onSubmit={onSubmit} className="mt-5 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: "var(--asky-fg-muted)" }}>Username</label>
                <input
                  ref={focusRef}
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  placeholder="Username"
                  className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition focus:ring-2"
                  style={{ background: "var(--asky-bg-input)", borderColor: "var(--asky-border)", color: "var(--asky-fg)" }}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: "var(--asky-fg-muted)" }}>Password</label>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  placeholder="Password"
                  className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition focus:ring-2"
                  style={{ background: "var(--asky-bg-input)", borderColor: "var(--asky-border)", color: "var(--asky-fg)" }}
                />
              </div>

              {error && (
                <div
                  className="rounded-lg px-3 py-2 text-xs"
                  style={{ background: "color-mix(in srgb, var(--asky-error) 12%, transparent)", color: "var(--asky-error)" }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
                style={{ background: "var(--asky-accent)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--asky-accent-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--asky-accent)")}
              >
                {loading && (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="44" strokeDashoffset="12" strokeLinecap="round" />
                  </svg>
                )}
                {loading ? "Signing in..." : "Sign in"}
              </button>

              <p className="pt-1 text-center text-[11px] leading-relaxed" style={{ color: "var(--asky-fg-muted)" }}>
                Your session stays on this device. Password is verified locally
                and never sent anywhere.
              </p>
            </form>
          </div>
        </section>
      </div>

      <footer className="border-t py-5 text-center text-xs" style={{ borderColor: "var(--asky-border)", color: "var(--asky-fg-muted)" }}>
        Asky — {theme === "dark" ? <Moon size={11} className="mr-1 inline" /> : <Sun size={11} className="mr-1 inline" />}
        Everything stays on your device. No tracking, no analytics, no cookies.
      </footer>
    </div>
  );
}

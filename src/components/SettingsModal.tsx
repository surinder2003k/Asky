import { useState } from "react";
import { Check, Eye, EyeOff, X } from "lucide-react";
import { useApp, hashPin } from "../store";
import { testApiKey, type StreamCallbacks } from "../ai";
import type { ProviderKey } from "../providers";

const PROVIDER_META: { key: ProviderKey; label: string; envHint: string }[] = [
  { key: "nvidia", label: "Nvidia", envHint: "Get a key at build.nvidia.com" },
  { key: "opencode", label: "OpenCode Zen", envHint: "Get a key at opencode.ai" },
  { key: "mistral", label: "Mistral", envHint: "Get a key at console.mistral.ai" },
  { key: "groq", label: "Groq", envHint: "Get a key at console.groq.com" },
  { key: "openrouter", label: "OpenRouter", envHint: "Get a key at openrouter.ai" },
];

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const {
    settings,
    setApiKeys,
    setTheme,
    setAccent,
    setPinEnabled,
    setCustomInstructions,
  } = useApp();
  const [visibleKeys, setVisibleKeys] = useState<Partial<Record<ProviderKey, boolean>>>({});
  const [pinDraft, setPinDraft] = useState("");
  const [pinConfirmDraft, setPinConfirmDraft] = useState("");
  const [pinState, setPinState] = useState<"idle" | "error" | "same">("idle");
  const [testState, setTestState] = useState<Partial<Record<ProviderKey, { loading?: boolean; ok?: boolean; message?: string }>>>({});

  async function testProvider(pk: ProviderKey, key: string) {
    setTestState((s) => ({ ...s, [pk]: { loading: true, message: "" } }));
    const res = await testApiKey(pk, key);
    setTestState((s) => ({ ...s, [pk]: { ...res, loading: false } }));
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/60 p-0 sm:p-6">
      <div className="relative w-full max-w-xl bg-[var(--asky-bg-elev)] sm:rounded-2xl sm:my-8">
        <div className="flex items-center justify-between border-b border-[var(--asky-border)] px-5 py-3.5">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-white/5">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[calc(100vh-8rem)] overflow-y-auto px-5 py-4">
          {/* API keys */}
          <section className="mb-6">
            <h3 className="mb-1 text-sm font-semibold">API Keys</h3>
            <p className="mb-3 text-xs text-[var(--asky-fg-muted)]">
              Add your own API keys below — they stay only on your device. Free-tier keys are enough to chat.
            </p>
            <div className="space-y-2.5">
              {PROVIDER_META.map(({ key: pk, label, envHint }) => {
                const saved = settings.apiKeys[pk] || "";
                const state = testState[pk];
                return (
                  <div key={pk} className="rounded-xl border border-[var(--asky-border)] bg-[var(--asky-bg)] p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium">{label}</span>
                      <span className="text-[11px] text-[var(--asky-fg-muted)]">{envHint}</span>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type={visibleKeys[pk] ? "text" : "password"}
                          value={saved}
                          placeholder={`Paste your ${label} API key`}
                          onChange={(e) => setApiKeys({ [pk]: e.target.value })}
                          className="w-full rounded-lg border border-[var(--asky-border)] bg-[var(--asky-bg-input)] px-3 py-2 pr-9 text-sm outline-none focus:border-[var(--asky-accent)]"
                        />
                        <button
                          onClick={() => setVisibleKeys((v) => ({ ...v, [pk]: !v[pk] }))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--asky-fg-muted)] hover:text-[var(--asky-fg)]"
                        >
                          {visibleKeys[pk] ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      <button
                        onClick={() => testProvider(pk, saved)}
                        disabled={!saved.trim() || state?.loading}
                        className="flex items-center gap-1.5 rounded-lg bg-[var(--asky-accent)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--asky-accent-hover)] disabled:opacity-40"
                      >
                        {state?.loading ? "Testing…" : state?.ok ? "Tested ✓" : "Test"}
                      </button>
                    </div>
                    {state && !state.loading && (
                      <p className={`mt-1.5 text-xs ${state.ok ? "text-[var(--color-success)]" : "text-red-400"}`}>
                        {state.ok ? "Key works — model responded." : state.message || "Key failed. Check it and try again."}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Theme */}
          <section className="mb-6">
            <h3 className="mb-2 text-sm font-semibold">Theme</h3>
            <div className="flex gap-2">
              {(["dark", "light"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm capitalize ${
                    settings.theme === t
                      ? "border-[var(--asky-accent)] bg-[var(--asky-accent-soft)]"
                      : "border-[var(--asky-border)] hover:bg-white/5"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <h3 className="mb-2 mt-4 text-sm font-semibold">Accent color</h3>
            <div className="flex gap-2">
              {(["teal", "blue", "purple"] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => setAccent(a)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm capitalize ${
                    settings.accent === a
                      ? "border-[var(--asky-accent)] bg-[var(--asky-accent-soft)]"
                      : "border-[var(--asky-border)] hover:bg-white/5"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </section>

          {/* PIN lock */}
          <section className="mb-6">
            <h3 className="mb-2 text-sm font-semibold">PIN lock</h3>
            <p className="mb-3 text-xs text-[var(--asky-fg-muted)]">
              {settings.pinEnabled
                ? "Lock is on — you'll be asked for your PIN every time you open the app."
                : "Turn on to require a PIN whenever the site is opened."}
            </p>
            {!settings.pinEnabled ? (
              <div className="rounded-xl border border-[var(--asky-border)] bg-[var(--asky-bg)] p-3">
                <div className="flex gap-2">
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={pinDraft}
                    placeholder="Enter 4-6 digit PIN"
                    onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, ""))}
                    className="flex-1 rounded-lg border border-[var(--asky-border)] bg-[var(--asky-bg-input)] px-3 py-2 text-sm outline-none focus:border-[var(--asky-accent)]"
                  />
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={pinConfirmDraft}
                    placeholder="Confirm PIN"
                    onChange={(e) => setPinConfirmDraft(e.target.value.replace(/\D/g, ""))}
                    className="flex-1 rounded-lg border border-[var(--asky-border)] bg-[var(--asky-bg-input)] px-3 py-2 text-sm outline-none focus:border-[var(--asky-accent)]"
                  />
                  <button
                    onClick={() => {
                      if (pinDraft.length < 4) {
                        setPinState("error");
                        return;
                      }
                      if (pinDraft !== pinConfirmDraft) {
                        setPinState("same");
                        return;
                      }
                      setPinEnabled(true, hashPin(pinDraft));
                      setPinDraft("");
                      setPinConfirmDraft("");
                      setPinState("idle");
                    }}
                    className="rounded-lg bg-[var(--asky-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--asky-accent-hover)]"
                  >
                    Enable
                  </button>
                </div>
                {pinState === "error" && (
                  <p className="mt-1.5 text-xs text-red-400">PIN must be at least 4 digits.</p>
                )}
                {pinState === "same" && (
                  <p className="mt-1.5 text-xs text-red-400">PINs don't match — type again.</p>
                )}
              </div>
            ) : (
              <button
                onClick={() => setPinEnabled(false)}
                className="rounded-xl border border-red-500/30 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10"
              >
                Disable PIN lock
              </button>
            )}
          </section>

          {/* Custom instructions */}
          <section className="mb-2">
            <h3 className="mb-2 text-sm font-semibold">Custom instructions</h3>
            <textarea
              value={settings.customInstructions || ""}
              onChange={(e) => setCustomInstructions(e.target.value)}
              rows={4}
              placeholder="e.g. Reply in Hindi, keep answers short…"
              className="w-full rounded-xl border border-[var(--asky-border)] bg-[var(--asky-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--asky-accent)]"
            />
          </section>
        </div>
      </div>
    </div>
  );
}

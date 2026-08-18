import { useState } from "react";
import { Check, Eye, EyeOff, Keyboard, Plus, Trash2, X, Mic, Monitor } from "lucide-react";
import type { CustomModelDef, Settings, PromptTemplate } from "../storage";
import { PROVIDER_LABELS } from "../providers";
import { useApp, hashPin } from "../store";
import { testApiKey, type StreamCallbacks } from "../ai";
import type { ProviderKey } from "../providers";
import { VOICE_LANGUAGES } from "../voice";

const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: "Ctrl+K", label: "New chat" },
  { keys: "Ctrl+/", label: "Focus message box" },
  { keys: "Esc", label: "Close overlays / settings / sidebar" },
  { keys: "↑", label: "Edit & resend last sent message (in a chat)" },
];

const PROVIDER_META: { key: ProviderKey; label: string; envHint: string; getApiUrl: string }[] = [
  { key: "nvidia", label: "Nvidia", envHint: "build.nvidia.com", getApiUrl: "https://build.nvidia.com/explore/discover" },
  { key: "opencode", label: "OpenCode Zen", envHint: "opencode.ai", getApiUrl: "https://opencode.ai" },
  { key: "mistral", label: "Mistral", envHint: "console.mistral.ai", getApiUrl: "https://console.mistral.ai/api-keys/" },
  { key: "groq", label: "Groq", envHint: "console.groq.com", getApiUrl: "https://console.groq.com/keys" },
  { key: "openrouter", label: "OpenRouter", envHint: "openrouter.ai", getApiUrl: "https://openrouter.ai/keys" },
];

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const {
    settings,
    setApiKeys,
    setTheme,
    setAccent,
    setVoiceLang,
    setPinEnabled,
    setCustomInstructions,
    updateSettings,
    setCustomModels,
    setTemplates,
  } = useApp();
  const [visibleKeys, setVisibleKeys] = useState<Partial<Record<ProviderKey, boolean>>>({});
  const [pinDraft, setPinDraft] = useState("");
  const [pinConfirmDraft, setPinConfirmDraft] = useState("");
  const [pinState, setPinState] = useState<"idle" | "error" | "same">("idle");
  const [testState, setTestState] = useState<Partial<Record<ProviderKey, { loading?: boolean; ok?: boolean; message?: string }>>>({});
  const [tplName, setTplName] = useState("");
  const [tplContent, setTplContent] = useState("");
  const [cmProvider, setCmProvider] = useState<ProviderKey>("nvidia");
  const [cmId, setCmId] = useState("");
  const [cmLabel, setCmLabel] = useState("");
  const [cmVision, setCmVision] = useState(false);

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
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-[var(--asky-hover)]">
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
              {PROVIDER_META.map(({ key: pk, label, envHint, getApiUrl }) => {
                const saved = settings.apiKeys[pk] || "";
                const state = testState[pk];
                return (
                  <div key={pk} className="rounded-xl border border-[var(--asky-border)] bg-[var(--asky-bg)] p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium">{label}</span>
                      <button
                        onClick={() => window.open(getApiUrl, "_blank", "noopener,noreferrer")}
                        className="flex items-center gap-1 rounded-md bg-[var(--asky-hover)] px-2 py-0.5 text-[11px] font-medium text-[var(--asky-accent)] hover:bg-[var(--asky-hover2)]"
                        title={`Get your API key from ${label}`}
                      >
                        Get API Key
                      </button>
                    </div>
                    <p className="mb-2 text-[11px] text-[var(--asky-fg-muted)]">{envHint}</p>
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
                      : "border-[var(--asky-border)] hover:bg-[var(--asky-hover)]"
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
                      : "border-[var(--asky-border)] hover:bg-[var(--asky-hover)]"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
            <h3 className="mb-2 mt-4 text-sm font-semibold">Voice input language</h3>
            <p className="mb-2 text-xs text-[var(--asky-fg-muted)]">Pick the language the mic button listens to.</p>
            <div className="flex gap-2">
              {VOICE_LANGUAGES.map((l) => (
                <button
                  key={l.key}
                  onClick={() => setVoiceLang(l.key)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm ${
                    (settings.voiceLang || "en") === l.key
                      ? "border-[var(--asky-accent)] bg-[var(--asky-accent-soft)]"
                      : "border-[var(--asky-border)] hover:bg-[var(--asky-hover)]"
                  }`}
                >
                  {l.label}
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

          {/* Keyboard shortcuts */}
          <section className="mb-6">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Keyboard size={14} /> Keyboard shortcuts
            </h3>
            <div className="overflow-hidden rounded-xl border border-[var(--asky-border)] bg-[var(--asky-bg)]">
              {SHORTCUTS.map((s, i) => (
                <div
                  key={s.keys}
                  className={`flex items-center justify-between px-3 py-2 text-sm ${
                    i > 0 ? "border-t border-[var(--asky-border)]" : ""
                  }`}
                >
                  <span className="text-[var(--asky-fg-muted)]">{s.label}</span>
                  <kbd className="rounded-md bg-[var(--asky-hover)] px-1.5 py-0.5 text-xs font-mono text-[var(--asky-fg)]">
                    {s.keys}
                  </kbd>
                </div>
              ))}
            </div>
          </section>

          {/* Chat appearance */}
          <section className="mb-6">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Monitor size={14} /> Chat appearance</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-[var(--asky-fg-muted)]">Chat width</label>
                <select
                  value={settings.chatWidth || "medium"}
                  onChange={(e) => updateSettings({ chatWidth: e.target.value as Settings["chatWidth"] })}
                  className="w-full rounded-lg border border-[var(--asky-border)] bg-[var(--asky-bg-input)] px-2.5 py-2 text-sm outline-none focus:border-[var(--asky-accent)]"
                >
                  <option value="compact">Compact</option>
                  <option value="medium">Medium</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-[var(--asky-fg-muted)]">Font size</label>
                <select
                  value={settings.fontSize || "medium"}
                  onChange={(e) => updateSettings({ fontSize: e.target.value as Settings["fontSize"] })}
                  className="w-full rounded-lg border border-[var(--asky-border)] bg-[var(--asky-bg-input)] px-2.5 py-2 text-sm outline-none focus:border-[var(--asky-accent)]"
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </div>
            </div>
          </section>

          {/* Advanced parameters */}
          <section className="mb-6">
            <h3 className="mb-1 text-sm font-semibold">Advanced generation parameters</h3>
            <p className="mb-3 text-xs text-[var(--asky-fg-muted)]">Tweak model outputs. Leave at defaults if unsure.</p>
            <div className="space-y-4 rounded-xl border border-[var(--asky-border)] bg-[var(--asky-bg)] p-4">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium">Temperature</span>
                  <span className="font-mono text-[var(--asky-fg-muted)]">{settings.temperature ?? 1}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={settings.temperature ?? 1}
                  onChange={(e) => updateSettings({ temperature: parseFloat(e.target.value) })}
                  className="w-full accent-[var(--asky-accent)]"
                />
                <div className="mt-0.5 flex justify-between text-[10px] text-[var(--asky-fg-muted)]"><span>Precise (0)</span><span>Creative (2)</span></div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium">Top-p</span>
                  <span className="font-mono text-[var(--asky-fg-muted)]">{settings.topP ?? 1}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.topP ?? 1}
                  onChange={(e) => updateSettings({ topP: parseFloat(e.target.value) })}
                  className="w-full accent-[var(--asky-accent)]"
                />
                <div className="mt-0.5 flex justify-between text-[10px] text-[var(--asky-fg-muted)]"><span>Focused (0)</span><span>Diverse (1)</span></div>
              </div>
            </div>
          </section>

          {/* Voice reply (TTS) */}
          <section className="mb-6">
            <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold"><Mic size={14} /> Voice reply (TTS)</h3>
            <p className="mb-3 text-xs text-[var(--asky-fg-muted)]">Speak assistant messages aloud with the speaker button under each message.</p>
            <div className="rounded-xl border border-[var(--asky-border)] bg-[var(--asky-bg)] p-4">
              <label className="mb-3 flex cursor-pointer items-center justify-between text-sm">
                <span>Enable voice reply</span>
                <input
                  type="checkbox"
                  checked={settings.ttsEnabled || false}
                  onChange={(e) => updateSettings({ ttsEnabled: e.target.checked })}
                  className="h-4 w-4 accent-[var(--asky-accent)]"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-[var(--asky-fg-muted)]">Speed</label>
                  <input
                    type="range"
                    min={0.5}
                    max={2}
                    step={0.1}
                    value={settings.ttsRate ?? 1}
                    onChange={(e) => updateSettings({ ttsRate: parseFloat(e.target.value) })}
                    disabled={!settings.ttsEnabled}
                    className="w-full accent-[var(--asky-accent)] disabled:opacity-40"
                  />
                  <div className="mt-0.5 text-center text-[10px] font-mono text-[var(--asky-fg-muted)]">{settings.ttsRate ?? 1}x</div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[var(--asky-fg-muted)]">Language</label>
                  <select
                    value={settings.ttsLang || "en"}
                    onChange={(e) => updateSettings({ ttsLang: e.target.value })}
                    disabled={!settings.ttsEnabled}
                    className="w-full rounded-lg border border-[var(--asky-border)] bg-[var(--asky-bg-input)] px-2.5 py-2 text-sm outline-none focus:border-[var(--asky-accent)] disabled:opacity-40"
                  >
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                    <option value="automatic">Automatic</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* Prompt templates */}
          <section className="mb-6">
            <h3 className="mb-1 text-sm font-semibold">Prompt templates</h3>
            <p className="mb-3 text-xs text-[var(--asky-fg-muted)]">Saved prompts you can tap-insert from the chat box "Templates" button.</p>
            <div className="space-y-1.5 rounded-xl border border-[var(--asky-border)] bg-[var(--asky-bg)] p-2">
              {(settings.templates || []).map((t, i) => (
                <div key={i} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{t.name}</div>
                    <div className="truncate text-[11px] text-[var(--asky-fg-muted)]">{t.content}</div>
                  </div>
                  <button
                    onClick={() => setTemplates((settings.templates || []).filter((_, j) => j !== i))}
                    className="rounded-md p-1.5 text-[var(--asky-fg-muted)] hover:bg-red-500/10 hover:text-red-400"
                    title="Delete template"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {settings.templates && settings.templates.length > 0 || (settings.templates || []).length === 0 && (
                <p className="px-2 py-1 text-[11px] text-[var(--asky-fg-muted)]">No templates yet.</p>
              )}
            </div>
            <div className="mt-3 rounded-xl border border-[var(--asky-border)] bg-[var(--asky-bg-input)] p-3">
              <input
                value={tplName}
                onChange={(e) => setTplName(e.target.value)}
                placeholder="Template name (e.g. Summarize)"
                className="mb-2 w-full rounded-lg border border-[var(--asky-border)] bg-[var(--asky-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--asky-accent)]"
              />
              <textarea
                value={tplContent}
                onChange={(e) => setTplContent(e.target.value)}
                rows={2}
                placeholder="Prompt text…"
                className="mb-2 w-full rounded-lg border border-[var(--asky-border)] bg-[var(--asky-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--asky-accent)]"
              />
              <button
                disabled={!tplName.trim() || !tplContent.trim()}
                onClick={() => {
                  setTemplates([...(settings.templates || []), { id: String(Date.now()), name: tplName.trim(), content: tplContent.trim() }]);
                  setTplName("");
                  setTplContent("");
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--asky-accent)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--asky-accent-hover)] disabled:opacity-40"
              >
                <Plus size={14} /> Add template
              </button>
            </div>
          </section>

          {/* Custom models */}
          <section className="mb-6">
            <h3 className="mb-1 text-sm font-semibold">Custom models</h3>
            <p className="mb-3 text-xs text-[var(--asky-fg-muted)]">Add any free model ID from your providers (e.g. a beta model on OpenRouter).</p>
            <div className="space-y-1.5 rounded-xl border border-[var(--asky-border)] bg-[var(--asky-bg)] p-2">
              {(settings.customModels || []).map((m, i) => (
                <div key={i} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{m.label}</div>
                    <div className="truncate text-[11px] text-[var(--asky-fg-muted)]">
                      {m.provider} · {m.modelId}
                      {m.vision ? " · vision" : ""}
                    </div>
                  </div>
                  <button
                    onClick={() => setCustomModels((settings.customModels || []).filter((_, j) => j !== i))}
                    className="rounded-md p-1.5 text-[var(--asky-fg-muted)] hover:bg-red-500/10 hover:text-red-400"
                    title="Delete model"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {settings.customModels && settings.customModels.length > 0 || (settings.customModels || []).length === 0 && (
                <p className="px-2 py-1 text-[11px] text-[var(--asky-fg-muted)]">No custom models yet.</p>
              )}
            </div>
            <div className="mt-3 rounded-xl border border-[var(--asky-border)] bg-[var(--asky-bg-input)] p-3">
              <div className="mb-2 grid grid-cols-2 gap-2">
                <select
                  value={cmProvider}
                  onChange={(e) => setCmProvider(e.target.value as ProviderKey)}
                  className="rounded-lg border border-[var(--asky-border)] bg-[var(--asky-bg)] px-2.5 py-2 text-sm outline-none focus:border-[var(--asky-accent)]"
                >
                  {(Object.keys(PROVIDER_LABELS) as ProviderKey[]).map((p) => (
                    <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
                  ))}
                </select>
                <input
                  value={cmLabel}
                  onChange={(e) => setCmLabel(e.target.value)}
                  placeholder="Label (e.g. Orion Mini)"
                  className="rounded-lg border border-[var(--asky-border)] bg-[var(--asky-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--asky-accent)]"
                />
              </div>
              <input
                value={cmId}
                onChange={(e) => setCmId(e.target.value)}
                placeholder="Model ID (e.g. openai/gpt-oss-20b)"
                className="mb-2 w-full rounded-lg border border-[var(--asky-border)] bg-[var(--asky-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--asky-accent)]"
              />
              <label className="mb-2 flex cursor-pointer items-center gap-2 text-xs text-[var(--asky-fg-muted)]">
                <input
                  type="checkbox"
                  checked={cmVision}
                  onChange={(e) => setCmVision(e.target.checked)}
                  className="h-4 w-4 accent-[var(--asky-accent)]"
                />
                Can analyze images (vision model)
              </label>
              <button
                disabled={!cmId.trim() || !cmLabel.trim()}
                onClick={() => {
                  const id = cmId.trim();
                  setCustomModels([
                    ...(settings.customModels || []),
                    { id: String(Date.now()) + '-' + Math.random().toString(36).slice(2,7), provider: cmProvider, label: cmLabel.trim(), modelId: id, vision: cmVision },
                  ]);
                  setCmId("");
                  setCmLabel("");
                  setCmVision(false);
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--asky-accent)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--asky-accent-hover)] disabled:opacity-40"
              >
                <Plus size={14} /> Add custom model
              </button>
            </div>
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

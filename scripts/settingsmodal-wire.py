P = "/home/ubuntu/ai_chat_app/src/components/SettingsModal.tsx"
s = open(P).read()

def repl(old, new, count=1):
    global s
    assert s.count(old) >= count, f"anchor not found ({count}): {old[:100]}"
    s = s.replace(old, new, count)

# 1. Destructure new actions
repl(
    '    setCustomInstructions,\n  } = useApp();',
    '    setCustomInstructions,\n    updateSettings,\n    setCustomModels,\n    setTemplates,\n  } = useApp();',
    1,
)

# 2. Local state for templates/custom models + imports
repl(
    'import { useState } from "react";\nimport { Check, Eye, EyeOff, Keyboard, X } from "lucide-react";',
    'import { useState } from "react";\nimport { Check, Eye, EyeOff, Keyboard, Plus, Trash2, X, Mic, Monitor } from "lucide-react";\nimport type { CustomModelDef, Settings, PromptTemplate } from "../storage";\nimport { PROVIDER_LABELS } from "../providers";',
    1,
)
repl(
    '  const [testState, setTestState] = useState<Partial<Record<ProviderKey, { loading?: boolean; ok?: boolean; message?: string }>>>({});',
    '  const [testState, setTestState] = useState<Partial<Record<ProviderKey, { loading?: boolean; ok?: boolean; message?: string }>>>({});\n  const [tplName, setTplName] = useState("");\n  const [tplContent, setTplContent] = useState("");\n  const [cmProvider, setCmProvider] = useState<ProviderKey>("nvidia");\n  const [cmId, setCmId] = useState("");\n  const [cmLabel, setCmLabel] = useState("");\n  const [cmVision, setCmVision] = useState(false);',
    1,
)

# 3. Insert new sections before Custom instructions section anchor
new_sections = """          {/* Chat appearance */}
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
                  <span className="font-mono text-[var(--asky-fg-muted)]">{settings.top_p ?? 1}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.top_p ?? 1}
                  onChange={(e) => updateSettings({ top_p: parseFloat(e.target.value) })}
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
                  setTemplates([...(settings.templates || []), { name: tplName.trim(), content: tplContent.trim() }]);
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
                      {m.provider} · {m.key}
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
                    { key: `${cmProvider}:${id}`, provider: cmProvider, label: cmLabel.trim(), modelId: id, vision: cmVision },
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

"""
repl('          {/* Custom instructions */}\n          <section className="mb-2">', new_sections + '          {/* Custom instructions */}\n          <section className="mb-2">', 1)

open(P, "w").write(s)
print("done")

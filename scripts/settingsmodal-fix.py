P1 = "/home/ubuntu/ai_chat_app/src/store.tsx"
s1 = open(P1).read()
if "updateSettings:" not in s1:
    # add declaration to Ctx interface
    s1 = s1.replace(
        '  setCustomModels: (models: Settings["customModels"]) => void;',
        '  setCustomModels: (models: Settings["customModels"]) => void;\n  updateSettings: (patch: Partial<Settings>) => void;',
    )
    open(P1, "w").write(s1)
    print("store fixed")
else:
    print("store already has updateSettings")

P2 = "/home/ubuntu/ai_chat_app/src/components/SettingsModal.tsx"
s2 = open(P2).read()
s2 = s2.replace("settings.top_p", "settings.topP")
s2 = s2.replace("updateSettings({ top_p:", "updateSettings({ topP:")
# add id fields with genId if available, else Date.now
if "genId" in s2 or "Date.now" in s2:
    pass
# template add: give id
s2 = s2.replace(
    "setTemplates([...(settings.templates || []), { name: tplName.trim(), content: tplContent.trim() }]);",
    "setTemplates([...(settings.templates || []), { id: String(Date.now()), name: tplName.trim(), content: tplContent.trim() }]);",
)
# custom model def: use id instead of key, drop key
s2 = s2.replace(
    "m.provider} · {m.key}\n                      {m.vision ? \" · vision\" : \"\"}",
    "m.provider} · {m.modelId}\n                      {m.vision ? \" · vision\" : \"\"}",
)
s2 = s2.replace(
    "{ provider: cmProvider, label: cmLabel.trim(), modelId: id, vision: cmVision },",
    "{ id: String(Date.now()) + \"-\" + Math.random().toString(36).slice(2, 7), provider: cmProvider, label: cmLabel.trim(), modelId: id, vision: cmVision },",
)
open(P2, "w").write(s2)
print("modal fixed")

/**
 * expo-quick-ask config plugin
 *
 * Adds Android static app shortcuts (launcher icon long-press menu) so the
 * user can jump straight into the chat screen from the home screen:
 *   - "New Chat"  -> opens the app (deep link {scheme}://new)
 *   - "Ask AI"    -> opens the app (deep link {scheme}://ask)
 *
 * Works with Expo prebuild / EAS Build. The shortcuts.xml and string
 * resources are injected into the managed project at build time.
 *
 * Usage in app.config.ts plugins: ["./plugins/quick-ask-plugin"]
 */
const fs = require("fs");
const path = require("path");
const {
  withAndroidManifest,
  withDangerousMod,
  AndroidConfig,
} = require("@expo/config-plugins");

module.exports = function withQuickAsk(config) {
  // 1) Point the main activity at the shortcuts meta-data resource
  config = withAndroidManifest(config, (mod) => {
    const activity =
      mod.modResults.manifest.$?.application?.[0]?.activity?.find(
        (a) => a.$?.["android:name"] === ".MainActivity",
      ) ?? mod.modResults.manifest.$?.application?.[0]?.activity?.[0];
    if (activity) {
      activity["meta-data"] = activity["meta-data"] || [];
      activity["meta-data"].push({
        $: {
          "android:name": "android.app.shortcuts",
          "android:resource": "@xml/shortcuts",
        },
      });
    }
    return mod;
  });

  // 2) Generate the shortcuts.xml + strings at prebuild time
  config = withDangerousMod(config, [
    "android",
    async (mod) => {
      const package = AndroidConfig.Package.getPackage(mod.modRequest.projectRoot) || mod.modRequest.projectName;
      // AndroidConfig.Scheme.getSchemes was removed in newer @expo/config-plugins;
      // extract the scheme from the VIEW intent filters in the manifest instead.
      let scheme = config.scheme || "manusapp";
      try {
        const schemes = AndroidConfig.Scheme.getSchemesFromManifest(mod.modResults, null);
        if (Array.isArray(schemes) && schemes.length > 0) scheme = schemes[0];
      } catch {
        // fall through to the fallback above
      }

      const resDir = path.join(mod.modRequest.platformProjectRoot, "app", "src", "main", "res");
      const xmlDir = path.join(resDir, "xml");
      const valuesDir = path.join(resDir, "values");
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.mkdirSync(valuesDir, { recursive: true });

      const shortcutsXml = `<?xml version="1.0" encoding="utf-8"?>
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
  <shortcut
    android:shortcutId="new_chat"
    android:enabled="true"
    android:shortcutShortLabel="@string/shortcut_new_chat_short"
    android:shortcutLongLabel="@string/shortcut_new_chat_long">
    <intent
      android:action="android.intent.action.VIEW"
      android:targetPackage="${package}"
      android:targetClass="host.exp.exponent.MainActivity"
      android:data="${scheme}://new" />
  </shortcut>
  <shortcut
    android:shortcutId="ask_ai"
    android:enabled="true"
    android:shortcutShortLabel="@string/shortcut_ask_ai_short"
    android:shortcutLongLabel="@string/shortcut_ask_ai_long">
    <intent
      android:action="android.intent.action.VIEW"
      android:targetPackage="${package}"
      android:targetClass="host.exp.exponent.MainActivity"
      android:data="${scheme}://ask" />
  </shortcut>
</shortcuts>
`;
      fs.writeFileSync(path.join(xmlDir, "shortcuts.xml"), shortcutsXml);

      // Merge shortcut strings into strings.xml if it exists, else create
      const stringsPath = path.join(valuesDir, "strings.xml");
      const additions = [
        '    <string name="shortcut_new_chat_short">New Chat</string>',
        '    <string name="shortcut_new_chat_long">Start a new chat</string>',
        '    <string name="shortcut_ask_ai_short">Ask AI</string>',
        '    <string name="shortcut_ask_ai_long">Open Asky and ask AI</string>',
      ];
      if (fs.existsSync(stringsPath)) {
        let content = fs.readFileSync(stringsPath, "utf8");
        for (const line of additions) {
          const name = line.match(/name="([^"]+)"/)[1];
          if (!content.includes(`name="${name}"`)) {
            content = content.replace("</resources>", `${line}\n</resources>`);
          }
        }
        fs.writeFileSync(stringsPath, content);
      } else {
        fs.writeFileSync(
          stringsPath,
          `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n${additions.join("\n")}\n</resources>\n`,
        );
      }
      return mod;
    },
  ]);

  return config;
};

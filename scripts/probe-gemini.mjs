// Gemini streaming probe via local dev proxy (:3001).
// Usage: KEY=<api-key> node scripts/probe-gemini.mjs [model]
const KEY = process.env.KEY || "";
const MODEL = process.argv[2] || "gemini-3.5-flash-lite";
const PORT = process.argv[3] || 3001;
const res = await fetch(`http://127.0.0.1:${PORT}/api/chat`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  signal: AbortSignal.timeout(60000),
  body: JSON.stringify({
    providerKey: "gemini",
    apiKey: KEY,
    modelId: MODEL,
    gemini: {
      modelId: MODEL,
      body: {
        contents: [{ role: "user", parts: [{ text: "Say OK" }] }],
        generationConfig: { maxOutputTokens: 50 },
      },
    },
  }),
});
const txt = await res.text();
const lines = txt.split("\n").filter((l) => l.startsWith("data:"));
let total = "",
  started = false;
for (const l of lines) {
  const d = l.slice(5).trim();
  if (d === "[DONE]") continue;
  try {
    const j = JSON.parse(d);
    const t = j?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (t) {
      started = true;
      total += t;
    }
  } catch {
    /* raw line */
  }
}
console.log("status:", res.status, "| lines:", lines.length, "| started:", started, "| text:", JSON.stringify(total));

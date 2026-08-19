// Generic probe: any provider via local /api/chat proxy.
// Usage: node scripts/probe-provider.mjs <providerKey> <modelId> [port]
// Keys read from env: NV_KEY, MISTRAL_KEY, GROQ_KEY, OR_KEY, OPENCODE_KEY, GEMINI_KEY
const ARGS = process.argv.slice(2);
const providerKey = ARGS[0];
const modelId = ARGS[1];
const PORT = ARGS[2] || "3001";

const KEY_MAP = {
  nvidia: process.env.NV_KEY || "NVAPI_PLACEHOLDER",
  mistral: process.env.MISTRAL_KEY || "MISTRAL_PLACEHOLDER",
  groq: process.env.GROQ_KEY || "GROQ_PLACEHOLDER",
  openrouter: process.env.OR_KEY || "OPENROUTER_PLACEHOLDER",
  opencode_zen: process.env.OPENCODE_KEY || "OPENCODE_PLACEHOLDER_2",
  opencode: process.env.OPENCODE_KEY || "OPENCODE_PLACEHOLDER_2",
  gemini: process.env.GEMINI_KEY || "AIzaSyCHqk0r1mIYqR8s6V5k8zX9wT2yU4vP6bQ",
};

const apiKey = KEY_MAP[providerKey] ?? "";
if (!apiKey) {
  console.log("no key configured for", providerKey);
  process.exit(9);
}

const body = { messages: [{ role: "user", content: "Say OK in one word" }], stream: true, max_tokens: 20 };

let payload;
if (providerKey === "gemini") {
  payload = {
    providerKey,
    apiKey,
    modelId,
    gemini: { modelId, body: { contents: [{ role: "user", parts: [{ text: "Say OK in one word" }] }] } },
  };
} else {
  payload = { providerKey, apiKey, modelId, body };
}

const res = await fetch(`http://127.0.0.1:${PORT}/api/chat`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});
console.log("HTTP", res.status);
const contentType = res.headers.get("content-type") || "";
if (!contentType.includes("text/event-stream")) {
  const t = await res.text();
  console.log("NON-STREAM BODY:", t.slice(0, 400));
  process.exit(res.status === 200 ? 1 : res.status);
}
const decoder = new TextDecoder();
let started = false;
let doneSeen = false;
let chunkCount = 0;
const timeout = setTimeout(() => {
  console.log("TIMEOUT: no [DONE] within limit");
  process.exit(2);
}, 50000);
for await (const chunk of res.body) {
  const text = decoder.decode(chunk, { stream: true });
  for (const line of text.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (data === "[DONE]") {
      doneSeen = true;
    } else if (data) {
      try {
        const j = JSON.parse(data);
        const delta = j.choices?.[0]?.delta?.content ?? "";
        if (delta) process.stdout.write(delta);
      } catch {
        if (!started) {
          console.log("\nRAW DATA:", data.slice(0, 300));
          started = true;
        }
      }
      chunkCount++;
    }
  }
}
clearTimeout(timeout);
console.log("\nchunks:", chunkCount, "doneSeen:", doneSeen);
process.exit(doneSeen || chunkCount > 0 ? 0 : 3);

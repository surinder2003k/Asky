// Test the PUBLISHED site's /api/chat with the real env key.
const KEY = process.env.NVIDIA_API_KEY || process.env.NVAPI_KEY || "";
console.log("key present:", !!KEY);

const r = await fetch("https://aichatapp-8ksusdph.manus.space/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    providerKey: "nvidia",
    apiKey: KEY,
    modelId: "z-ai/glm-5.2",
    body: {
      model: "z-ai/glm-5.2",
      messages: [{ role: "user", content: "Say OK" }],
      stream: true,
      max_tokens: 64,
    },
  }),
  signal: AbortSignal.timeout(90000),
});
const txt = await r.text();
console.log("HTTP", r.status);
console.log(txt.slice(0, 600));

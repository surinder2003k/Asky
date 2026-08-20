// Probe GLM 5.2 through the local proxy to reproduce the user's 400/502.
const KEY = process.env.NVIDIA_API_KEY || process.env.NVAPI_KEY || "";
console.log("key present:", !!KEY);

const r = await fetch("http://localhost:5173/api/chat", {
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
  signal: AbortSignal.timeout(60000),
});
const txt = await r.text();
console.log("HTTP", r.status);
console.log(txt.slice(0, 500));

// Probe Nvidia streaming via the local ai-proxy, capturing full SSE output and exit status.
const KEY = process.env.NV_KEY || "NVAPI_PLACEHOLDER";
const MODEL = process.argv[2] || "nvidia/llama-3.1-8b-instruct";
const PORT = process.argv[3] || "3001";

const res = await fetch(`http://127.0.0.1:${PORT}/api/chat`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    providerKey: "nvidia",
    apiKey: KEY,
    modelId: MODEL,
    body: { messages: [{ role: "user", content: "Say OK in one word" }], stream: true },
  }),
});
console.log("HTTP", res.status);
const contentType = res.headers.get("content-type") || "";
if (!contentType.includes("text/event-stream")) {
  const t = await res.text();
  console.log("NON-STREAM BODY:", t.slice(0, 600));
  process.exit(res.status === 200 ? 1 : res.status);
}
const decoder = new TextDecoder();
let started = false;
let doneSeen = false;
let chunkCount = 0;
const timeout = setTimeout(() => {
  console.log("TIMEOUT: no [DONE] within limit");
  process.exit(2);
}, 45000);
for await (const chunk of res.body) {
  const text = decoder.decode(chunk, { stream: true });
  for (const line of text.split("\n")) {
    if (line.startsWith("data: ")) {
      const data = line.slice(6);
      if (data === "[DONE]") {
        doneSeen = true;
      } else {
        try {
          const j = JSON.parse(data);
          const delta = j.choices?.[0]?.delta?.content || "";
          if (delta) process.stdout.write(delta);
        } catch (e) {
          if (!started) {
            console.log("\nPARSED DATA:", data.slice(0, 200));
            started = true;
          }
        }
      }
      chunkCount++;
    }
  }
}
clearTimeout(timeout);
console.log("\nchunks:", chunkCount, "doneSeen:", doneSeen);
process.exit(doneSeen ? 0 : 3);

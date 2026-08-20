// Model health matrix v3: uses providers.ts MODELS + PROVIDERS + resolveModelId
// (bareId stripping), and hits the prod proxy POST /api/chat with the platform
// env key passed as apiKey. Detects streamed content via "content":"..." OR
// delta content. Prints per-model status + first streamed token.
import { build } from "esbuild";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TIMEOUT = Number(process.argv[2] || 45) * 1000;

const tmp = path.resolve(__dirname, "../.tmp-providers.mjs");
await build({
  entryPoints: [path.resolve(__dirname, "../src/providers.ts")],
  outfile: tmp,
  format: "esm",
  platform: "neutral",
});
const { MODELS, resolveModelId } = await import(tmp);
fs.unlinkSync(tmp);

const ENV_KEYS = {
  nvidia: process.env.AI_NVIDIA_API_KEY || process.env.NVIDIA_API_KEY,
  mistral: process.env.AI_MISTRAL_API_KEY,
  groq: process.env.AI_GROQ_API_KEY,
  openrouter: process.env.AI_OPENROUTER_API_KEY,
  opencode: process.env.AI_OPENCODE_ZEN_API_KEY,
  gemini: process.env.AI_GEMINI_API_KEY,
};

const PORT = 3000;
const results = [];

async function probe(model) {
  const providerKey = model.provider;
  const key = ENV_KEYS[providerKey] || "";
  const modelId = resolveModelId(model);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(`http://localhost:${PORT}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        providerKey,
        apiKey: key,
        modelId: model.key,
        body: {
          model: modelId,
          messages: [{ role: "user", content: "Say exactly: PING" }],
          stream: true,
        },
      }),
    });
    clearTimeout(timer);
    const status = res.status;
    let out = "";
    let errText = "";
    if (!res.ok) {
      const t = await res.text();
      errText = t.slice(0, 150);
    } else {
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      const deadline = Date.now() + TIMEOUT;
      while (Date.now() < deadline) {
        const { done, value } = await reader.read().catch(() => ({ done: true, value: undefined }));
        if (done) break;
        buf += dec.decode(value, { stream: true });
        // Content may arrive as "content":"X" or delta":{"content":"X" — both match.
        const m = buf.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)"/g);
        if (m && m.length > 1) {
          const last = m[m.length - 1];
          const v = last.match(/"((?:[^"\\]|\\.)*)"/)[1];
          if (v) { out = v.replace(/\\u000a|\\n/g, " ").slice(0, 60); break; }
        }
      }
      try { await reader.cancel(); } catch {}
    }
    return { key: model.key, modelId, status, out: out || null, err: errText };
  } catch (e) {
    clearTimeout(timer);
    return { key: model.key, modelId, status: 0, out: null, err: e.name || String(e) };
  }
}

for (const m of MODELS) {
  const r = await probe(m);
  const ok = r.status === 200 && r.out;
  results.push(r);
  console.log(
    `${ok ? "OK " : "ERR"} ${m.label.padEnd(24)} (${m.provider.padEnd(10)}) id=${String(r.modelId).padEnd(45)} status=${r.status || r.err}` +
    (r.out ? `  -> ${r.out}` : r.err ? `  | ${r.err}` : ""),
  );
}
const okCount = results.filter((r) => r.status === 200 && r.out).length;
console.log(`\nSUMMARY: ${okCount}/${MODELS.length} models OK`);

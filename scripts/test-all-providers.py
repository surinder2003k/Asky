#!/usr/bin/env python3
"""End-to-end test of all AI providers through the local dev API server."""
import json
import subprocess
import sys

KEYS = {
    "nvidia": "NVAPI_PLACEHOLDER",
    "mistral": "MISTRAL_PLACEHOLDER",
    "groq": "GROQ_PLACEHOLDER",
    "openrouter": "OPENROUTER_PLACEHOLDER",
    "opencode_zen": "OPENCODE_PLACEHOLDER_1",
}

TESTS = [
    ("nvidia", "nvidia/nvidia/llama-3.1-8b-instruct"),
    ("mistral", "mistral/mistral-small-latest"),
    ("groq", "groq/gemma2-9b-it"),
    ("openrouter", "openrouter/google/gemma-3-27b-it:free"),
    ("opencode_zen", "opencode_zen/glm-4.5-flash"),
]

PROMPT = "Say the word OK and nothing else."

def run_test(provider, model):
    payload = {
        "providerKey": provider,
        "apiKey": KEYS[provider],
        "modelId": model,
        "body": {"messages": [{"role": "user", "content": PROMPT}], "stream": True, "max_tokens": 10},
    }
    proc = subprocess.run(
        ["curl", "-s", "-m", "90", "-X", "POST", "http://127.0.0.1:3000/api/chat",
         "-H", "Content-Type: application/json", "-d", json.dumps(payload)],
        capture_output=True, text=True, timeout=100,
    )
    out = proc.stdout + proc.stderr
    # Inspect the stream tail
    # SSE stream chunks end with [DONE]; non-stream error is a JSON blob
    if out.startswith("{"):
        try:
            err = json.loads(out)
            return f"ERROR: {err.get('error', {}).get('message', out[:200])}"
        except Exception:
            return f"ERROR: {out[:200]}"
    # SSE output: collect last data payload lines
    lines = [l for l in out.splitlines() if l.startswith("data:")]
    if not lines:
        return "ERROR: no SSE data received"
    last = lines[-1][5:].strip()
    if last == "[DONE]":
        return "OK"
    return f"UNCLEAR: last chunk = {last[:150]}"

print(f"{'provider':14} {'model':45} {'result':60}")
failures = []
for provider, model in TESTS:
    result = run_test(provider, model)
    status = "OK" if result == "OK" else result
    print(f"{provider:14} {model:45} {status}")
    if result != "OK":
        failures.append((provider, model, result))

if failures:
    print("\nFAILURES:")
    for f in failures:
        print(f)
    sys.exit(1)
print("\nALL PROVIDERS OK")

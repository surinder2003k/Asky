#!/usr/bin/env python3
"""Probe Nvidia upstream directly with python requests (curl shows status 000 = TLS/connect hang)."""
import requests, json

KEY = "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"
HDR = {"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
URL = "https://integrate.api.nvidia.com/v1/chat/completions"

tests = [
    ("minimaxai/minimax-m3", False),
    ("meta/llama-3.3-70b-instruct", True),
    ("openai/gpt-oss-20b", False),
    ("z-ai/glm-5.2", False),
]

for model, stream in tests:
    body = {
        "model": model,
        "messages": [{"role": "user", "content": "Say hello in one word"}],
        "stream": stream,
        "max_tokens": 20,
    }
    try:
        r = requests.post(URL, headers=HDR, json=body, timeout=70, stream=stream)
        if stream:
            data = b""
            for chunk in r.iter_lines():
                if chunk and chunk.startswith(b"data:"):
                    data += chunk + b"\n"
                if len(data) > 800:
                    break
            print(f"[{model}] stream status={r.status_code} elapsed={r.elapsed.total_seconds():.1f}s len={len(data)}")
            print(data[:400].decode("utf-8", "replace"))
        else:
            print(f"[{model}] status={r.status_code} elapsed={r.elapsed.total_seconds():.1f}s")
            print(r.text[:300])
    except Exception as e:
        print(f"[{model}] EXCEPTION: {type(e).__name__}: {e}")
    print("---")

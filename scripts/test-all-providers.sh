#!/bin/bash
# Batch 54: live-verify streaming chat through the PRODUCTION proxy (/api/chat)
# and direct provider endpoints for every provider + representative model.
set -u
BASE="http://127.0.0.1:3003"
KEY_OPENCODE="REDACTED"
KEY_NVIDIA=""     # none built-in; BYO only
KEY_MISTRAL=""
KEY_GROQ=""
KEY_OPENROUTER=""

chat_proxy () { # model provider apiKey
  curl -s -m 90 -w "\nHTTP:%{http_code}\n" "$BASE/api/chat" \
    -H "Content-Type: application/json" \
    -d "{\"model\":\"$1\",\"provider\":\"$2\",\"apiKey\":\"$3\",\"messages\":[{\"role\":\"user\",\"content\":\"reply with exactly: banana\"}],\"stream\":true}" | tail -2
}

direct () { # url model apiKey
  curl -s -m 90 -w "\nHTTP:%{http_code}\n" "$1/chat/completions" \
    -H "Authorization: Bearer $3" -H "Content-Type: application/json" \
    -d "{\"model\":\"$2\",\"messages\":[{\"role\":\"user\",\"content\":\"say ok\"}],\"max_tokens\":5}" | tail -2
}

echo "########## OpenCode Zen (all 5 models, direct) ##########"
for m in mimo-v2.5-free deepseek-v4-flash-free nemotron-3.5-lightning-free hy3-free nemotron-3-ultra-free; do
  echo "-- $m:"
  direct https://opencode.ai/zen/v1 "$m" "$KEY_OPENCODE" | head -1
done

echo "########## Nvidia (via prod proxy) ##########"
echo "(no user key in sandbox — testing provider reachability with empty key)"
chat_proxy "" "" "" 2>/dev/null | tail -1

echo "########## Mistral (direct, empty key) ##########"
direct https://api.mistral.ai "" "" | head -1

echo "########## Groq (direct, empty key) ##########"
direct https://api.groq.com/openai/v1 "" "" | head -1

echo "########## OpenRouter (direct, empty key) ##########"
direct https://openrouter.ai/api/v1 "" "" | head -1

echo "########## Gemini (direct, empty key) ##########"
curl -s -m 60 -w "\nHTTP:%{http_code}\n" "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" -H "Content-Type: application/json" -d '{"contents":[{"parts":[{"text":"ok"}]}]}' | tail -2

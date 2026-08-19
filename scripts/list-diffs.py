#!/usr/bin/env python3
"""List the files that differ between local main tree and the last-synced website snapshot."""
import json
import os
import subprocess
import urllib.request

TOKEN = os.environ["GITHUB_PUSH_TOKEN"]
H = {"Authorization": f"Bearer {TOKEN}", "Accept": "application/vnd.github+json", "User-Agent": "sync"}
API = "https://api.github.com/repos/surinder2003k/Asky"
ROOT = "/home/ubuntu/ai_chat_app"
LAST = "70bd813272511b79ffe042a1a33a016dcfc7fbd2"

r = urllib.request.urlopen(urllib.request.Request(f"{API}/git/trees/{LAST}?recursive=1", headers=H))
old = {t["path"]: t["sha"] for t in json.loads(r.read())["tree"] if t["type"] == "blob"}

names = subprocess.run(["git", "ls-tree", "-r", "--name-only", "main"], capture_output=True, text=True, cwd=ROOT).stdout.splitlines()


def ho(p):
    return subprocess.run(["git", "hash-object", p], capture_output=True, text=True, cwd=ROOT).stdout.strip()


diffs = sorted(p for p in names if old.get(p) != ho(p))
print("total:", len(diffs))
for p in diffs:
    print(p)

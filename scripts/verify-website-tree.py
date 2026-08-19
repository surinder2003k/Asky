#!/usr/bin/env python3
"""Verify the current website branch commit tree: blob count and websearch.ts presence."""
import json
import os
import urllib.request

TOKEN = os.environ["GITHUB_PUSH_TOKEN"]
API = f"https://api.github.com/repos/surinder2003k/Asky"
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Accept": "application/vnd.github+json",
    "User-Agent": "verify-tree",
}

ref = json.load(urllib.request.urlopen(
    urllib.request.Request(f"{API}/git/ref/heads/website", headers=HEADERS), timeout=30))
sha = ref["object"]["sha"]
print("website ref:", sha)

commit = json.load(urllib.request.urlopen(
    urllib.request.Request(f"{API}/git/commits/{sha}", headers=HEADERS), timeout=30))
tree_sha = commit["tree"]["sha"]

tree = json.load(urllib.request.urlopen(
    urllib.request.Request(f"{API}/git/trees/{tree_sha}?recursive=1", headers=HEADERS), timeout=60))
blobs = [t for t in tree["tree"] if t["type"] == "blob"]
paths = [t["path"] for t in blobs]
print("blob count:", len(paths))
print("contains src/websearch.ts:", "src/websearch.ts" in paths)
print("contains src/storage.ts:", "src/storage.ts" in paths)

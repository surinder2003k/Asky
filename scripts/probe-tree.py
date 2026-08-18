#!/usr/bin/env python3
"""Reproduce the tree-creation 422: build the exact same tree_entries list the
sync script would, and POST it to /git/trees, printing the full error body."""
import json
import os
import subprocess
import sys
import urllib.request

TOKEN = os.environ["GITHUB_PUSH_TOKEN"]
API = "https://api.github.com/repos/surinder2003k/Asky"
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Accept": "application/vnd.github+json", "User-Agent": "probe-tree"}
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def sha_of(path):
    out = subprocess.run(["git", "rev-parse", f"main:{path}"], capture_output=True, text=True, cwd=ROOT)
    return out.stdout.strip() if out.returncode == 0 else None


def main():
    out = subprocess.run(["git", "ls-tree", "-r", "--name-only", "main"], capture_output=True, text=True, cwd=ROOT, check=True)
    paths = [p for p in out.stdout.splitlines() if "expressions2" not in p]
    entries = []
    bad = []
    for p in paths:
        s = sha_of(p)
        if not s or len(s) != 40:
            bad.append((p, s))
        entries.append({"path": p, "mode": "100644", "type": "blob", "sha": s})
    print(f"entries: {len(entries)}, bad: {bad[:10]}")
    if bad:
        return
    data = json.dumps({"tree": entries, "base_tree": "73aab071242a4aa325010e25c34e673932d8af68"}).encode()
    req = urllib.request.Request(f"{API}/git/trees", data=data, headers=HEADERS, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            print("OK:", json.loads(r.read())["sha"])
    except urllib.error.HTTPError as e:
        print(e.code, e.read().decode()[:800])


if __name__ == "__main__":
    main()

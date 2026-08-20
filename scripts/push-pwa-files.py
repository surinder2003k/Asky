#!/usr/bin/env python3
"""Push the PWA files + any website-specific local files that are missing from the
GitHub 'website' branch (which mirrors the expo snapshot and therefore never lists
files under 'public/' or newly added src files whose tree differs).
Uses the Git Data REST API, same as sync-via-api.py."""
import base64
import json
import os
import time
import urllib.request

TOKEN = os.environ["GITHUB_PUSH_TOKEN"]
OWNER, REPO, BRANCH = "surinder2003k", "Asky", "website"
API = f"https://api.github.com/repos/{OWNER}/{REPO}"
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Accept": "application/vnd.github+json",
    "User-Agent": "push-pwa",
}
PROJECT = "/home/ubuntu/ai_chat_app"

# Files that MUST exist on the website branch (PWA + app changes since last sync).
FILES = [
    "public/manifest.webmanifest",
    "public/icon-192.png",
    "public/icon-512.png",
    "public/apple-touch-icon.png",
    "src/components/InstallPrompt.tsx",
    "src/components/ChatScreen.tsx",
    "src/richMd.ts",
    "src/index.css",
    "index.html",
]

def api(path, payload=None, method="GET"):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(f"{API}{path}", data=data, headers=HEADERS, method=method)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())

def local_sha(path):
    import subprocess
    out = subprocess.run(
        ["git", "hash-object", os.path.join(PROJECT, path)],
        capture_output=True, text=True, cwd=PROJECT,
    )
    return out.stdout.strip() if out.returncode == 0 else None

def blob_payload(path):
    full = os.path.join(PROJECT, path)
    with open(full, "rb") as f:
        content = f.read()
    is_binary = b"\x00" in content[:8192]
    if is_binary:
        return {"content": base64.b64encode(content).decode(), "encoding": "base64"}
    return {"content": content.decode("utf-8", errors="replace"), "encoding": "utf-8"}

def main():
    ref = api(f"/git/ref/heads/{BRANCH}")
    base_sha = ref["object"]["sha"]
    remote_tree = api(f"/git/trees/{base_sha}?recursive=1")["tree"]
    remote = {t["path"]: t.get("sha") for t in remote_tree if t["type"] == "blob"}
    print(f"Remote tip: {base_sha}, blobs: {len(remote)}")

    to_add = []
    for path in FILES:
        lsha = local_sha(path)
        if lsha is None:
            print("SKIP (missing locally):", path)
            continue
        if remote.get(path) == lsha:
            print("ALREADY:", path)
            continue
        to_add.append((path, lsha))
    print(f"Files to push: {len(to_add)}")

    tree_entries = []
    for path, lsha in to_add:
        api("/git/blobs", blob_payload(path), "POST")
        print("blob OK:", path)
        tree_entries.append({"path": path, "mode": "100644", "type": "blob", "sha": lsha})
        time.sleep(0.3)

    if not tree_entries:
        print("Nothing to push.")
        return

    new_tree = api("/git/trees", {"tree": tree_entries, "base_tree": base_sha}, "POST")
    commit = api("/git/commits", {
        "message": "Batch 86 sync: PWA install (manifest, icons, InstallPrompt) + website fixes",
        "tree": new_tree["sha"],
        "parents": [base_sha],
    }, "POST")
    res = api(f"/git/refs/heads/{BRANCH}", {"sha": commit["sha"]}, "PATCH")
    print(f"website now at {res['object']['sha']}")
    print("PUSH COMPLETE")

if __name__ == "__main__":
    main()

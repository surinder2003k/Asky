#!/usr/bin/env python3
"""Full sync of local `main` tree to GitHub branch `website` via Git Data REST API.

Unlike sync-via-api.py (which compared against the REMOTE website branch tip and
failed here because remote had untracked drift), this script compares the local
main tree against the LAST-SYNCED website commit 70bd813272511b79ffe042a1a33a016dcfc7fbd2
(the Batch 69 snapshot, parent of all later website commits), so remote drift
(e.g. repo-filter additions) does not interfere.

It posts blobs for every changed local file, builds a tree with ALL local files
(except src/websearch.ts), commits on top of the CURRENT website tip, and moves
the ref. Deletions are handled by simply omitting removed paths from the new tree.
"""
import base64
import json
import os
import subprocess
import sys
import time
import urllib.request

TOKEN = os.environ["GITHUB_PUSH_TOKEN"]
OWNER, REPO = "surinder2003k", "Asky"
BRANCH = "website"
API = f"https://api.github.com/repos/{OWNER}/{REPO}"
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Accept": "application/vnd.github+json",
    "User-Agent": "sync-full-via-api",
}
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Last synced snapshot tree (Batch 69) — compare against this, not remote tip.
LAST_SYNC_TREE = "70bd813272511b79ffe042a1a33a016dcfc7fbd2"
# Files to keep deleted (removed in Batch 70):
DELETED = {"src/websearch.ts"}


def req(method, path, payload=None, timeout=60):
    data = json.dumps(payload).encode() if payload is not None else None
    r = urllib.request.Request(f"{API}{path}", data=data, headers=HEADERS, method=method)
    with urllib.request.urlopen(r, timeout=timeout) as resp:
        return json.loads(resp.read()) if resp.status != 204 else None


def local_tree():
    """Return {path: blob_sha} for the current main tree (use git hash-object on
    the WORKING tree for files matching local commits; fallback to committed sha)."""
    names = subprocess.run(
        ["git", "ls-tree", "-r", "--name-only", "main"],
        capture_output=True, text=True, cwd=REPO_ROOT, check=True,
    ).stdout.splitlines()
    out = {}
    for name in names:
        sha = subprocess.run(
            ["git", "hash-object", os.path.join(REPO_ROOT, name)],
            capture_output=True, text=True, cwd=REPO_ROOT,
        ).stdout.strip()
        if sha:
            out[name] = sha
    return out


def main():
    dry = "--dry" in sys.argv

    print("Fetching current website ref...")
    ref = req("GET", f"/git/ref/heads/{BRANCH}")
    current_tip = ref["object"]["sha"]
    print(f"Website tip: {current_tip}")

    print("Fetching last-synced snapshot tree...")
    tree = req("GET", f"/git/trees/{LAST_SYNC_TREE}?recursive=1")
    old = {t["path"]: t["sha"] for t in tree["tree"] if t["type"] == "blob"}
    print(f"Last-synced blobs: {len(old)}")

    local = local_tree()
    # Apply deletions
    for d in DELETED:
        local.pop(d, None)
    print(f"Local blobs (after deletions): {len(local)}")

    to_post = [(p, s) for p, s in local.items() if old.get(p) != s]
    print(f"Blobs to post: {len(to_post)}")

    if dry:
        print("DRY RUN - done")
        return

    posted = 0
    for path, sha in sorted(to_post):
        full = os.path.join(REPO_ROOT, path)
        with open(full, "rb") as f:
            content = f.read()
        if b"\x00" in content[:8192]:
            payload = {"content": base64.b64encode(content).decode(), "encoding": "base64"}
        else:
            payload = {"content": content.decode("utf-8", errors="replace"), "encoding": "utf-8"}
        res = req("POST", "/git/blobs", payload)
        posted += 1
        if posted % 60 == 0:
            print(f"  ... {posted}/{len(to_post)} blobs posted")
            time.sleep(0.5)
    print(f"All {posted} blobs posted.")

    entries = [{"path": p, "mode": "100644", "type": "blob", "sha": s} for p, s in local.items()]
    # GitHub tree creation fills paths from base_tree unless the entry is present
    # in the entries list; deleting a file therefore requires an explicit null-sha
    # entry, not merely omitting it.
    entries += [{"path": d, "mode": "100644", "type": "blob", "sha": None} for d in DELETED]
    print(f"Creating tree with {len(entries)} entries (base: {LAST_SYNC_TREE})...")
    new_tree = req("POST", "/git/trees", {"tree": entries, "base_tree": LAST_SYNC_TREE})

    commit = req("POST", "/git/commits", {
        "message": "Batch 70 sync: web search removed; all latest improvements",
        "tree": new_tree["sha"],
        "parents": [current_tip],
    })
    new_sha = commit["sha"]
    print(f"Commit {new_sha}")

    res = req("PATCH", f"/git/refs/heads/{BRANCH}", {"sha": new_sha})
    print(f"website now at {res['object']['sha']}")
    print("SYNC COMPLETE")


if __name__ == "__main__":
    main()

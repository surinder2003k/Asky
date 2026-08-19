#!/usr/bin/env python3
"""Push README.md to GitHub branch `main` via Git Data REST API.

Builds a new tree from the CURRENT main tip tree, replacing the README.md blob
(if present), commits on top of the current tip, and moves the ref.
"""
import json
import os
import urllib.request

TOKEN = os.environ["GITHUB_PUSH_TOKEN"]
OWNER, REPO = "surinder2003k", "Asky"
BRANCH = "main"
API = f"https://api.github.com/repos/{OWNER}/{REPO}"
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Accept": "application/vnd.github+json",
    "User-Agent": "push-readme-main",
}


def req(method, path, payload=None, timeout=120):
    data = json.dumps(payload).encode() if payload is not None else None
    r = urllib.request.Request(f"{API}{path}", data=data, headers=HEADERS, method=method)
    with urllib.request.urlopen(r, timeout=timeout) as resp:
        return json.loads(resp.read()) if resp.status != 204 else None


def main():
    ref = req("GET", f"/git/ref/heads/{BRANCH}")
    tip = ref["object"]["sha"]
    print("Current main tip:", tip)

    commit = req("GET", f"/git/commits/{tip}")
    tree_sha = commit["tree"]["sha"]
    print("Current tree:", tree_sha)

    tree = req("GET", f"/git/trees/{tree_sha}?recursive=1")
    blobs = [t for t in tree["tree"] if t["type"] == "blob"]
    print(f"Tree has {len(blobs)} blobs")
    readme_sha = next((b["sha"] for b in blobs if b["path"] == "README.md"), None)
    print("README.md sha in tree:", readme_sha)

    with open("/home/ubuntu/ai_chat_app/README.md", "rb") as f:
        content = f.read()
    blob = req("POST", "/git/blobs", {
        "content": content.decode("utf-8"),
        "encoding": "utf-8",
    })
    print("New README blob:", blob["sha"])

    entries = [{"path": b["path"], "mode": "100644", "type": "blob", "sha": b["sha"]} for b in blobs]
    entries = [e for e in entries if e["path"] != "README.md"]
    entries.append({"path": "README.md", "mode": "100644", "type": "blob", "sha": blob["sha"]})
    new_tree = req("POST", "/git/trees", {"tree": entries, "base_tree": tree_sha})
    print("New tree:", new_tree["sha"])

    new_commit = req("POST", "/git/commits", {
        "message": "README: full project info, feature list, tech stack, setup guide, live link",
        "tree": new_tree["sha"],
        "parents": [tip],
    })
    print("Commit:", new_commit["sha"])

    res = req("PATCH", f"/git/refs/heads/{BRANCH}", {"sha": new_commit["sha"]})
    print(f"main now at {res['object']['sha']}")
    print("README PUSH TO MAIN COMPLETE")


if __name__ == "__main__":
    main()

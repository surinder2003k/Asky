#!/usr/bin/env python3
"""Check if GitHub recognizes the blob sha 462c5060... as valid.
Fetch GET /git/blobs/<sha> and also re-POST the file content to get its returned sha."""
import json
import os
import subprocess
import urllib.request

TOKEN = os.environ["GITHUB_PUSH_TOKEN"]
API = "https://api.github.com/repos/surinder2003k/Asky"
H = {"Authorization": f"Bearer {TOKEN}", "Accept": "application/vnd.github+json", "User-Agent": "probe-blob"}
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

TARGET_SHA = "462c5060e53a436640583c9b5f3846add59bff7c"


def req(url, method="GET", data=None):
    r = urllib.request.Request(url, headers=H, method=method,
                               data=json.dumps(data).encode() if data else None)
    try:
        with urllib.request.urlopen(r, timeout=60) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:600]


def main():
    code, body = req(f"{API}/git/blobs/{TARGET_SHA}")
    print("GET blob:", code, body[:300])

    # find local file with this sha
    out = subprocess.run(["git", "ls-tree", "-r", "main"], capture_output=True, text=True, cwd=ROOT).stdout
    for line in out.splitlines():
        if TARGET_SHA in line:
            path = line.split("\t")[-1]
            print("local path:", path)
            with open(os.path.join(ROOT, path), "rb") as f:
                content = f.read()
            is_binary = b"\x00" in content[:8192]
            payload = {"content": content.decode(errors="replace"), "encoding": "utf-8"} if not is_binary else {
                "content": __import__("base64").b64encode(content).decode(), "encoding": "base64"}
            code, body = req(f"{API}/git/blobs", "POST", payload)
            print("POST blob:", code, body[:400])
            if code == 201:
                returned_sha = json.loads(body)["sha"]
                print("returned sha:", returned_sha)
                # verify git hash matches
                out2 = subprocess.run(["git", "hash-object", "-w", os.path.join(ROOT, path)],
                                      capture_output=True, text=True, cwd=ROOT)
                print("git hash-object:", out2.stdout.strip())
            break
    else:
        print("sha not found in local tree!")


if __name__ == "__main__":
    main()

"""Verify remote website branch: no credential leakage, key files present."""
import json
import os
import urllib.request

tok = os.environ["GITHUB_PUSH_TOKEN"]
h = {
    "Authorization": f"Bearer {tok}",
    "Accept": "application/vnd.github+json",
    "User-Agent": "x",
}
API = "https://api.github.com/repos/surinder2003k/Asky"

sha = json.loads(
    urllib.request.urlopen(
        urllib.request.Request(f"{API}/git/refs/heads/website", headers=h), timeout=30
    ).read()
)["object"]["sha"]
tree = json.loads(
    urllib.request.urlopen(
        urllib.request.Request(f"{API}/git/trees/{sha}?recursive=1", headers=h), timeout=30
    ).read()
)["tree"]
paths = sorted(t["path"] for t in tree if t["type"] == "blob")
print("remote blobs:", len(paths))

# Check for credential leakage by path name and by scanning small text files
bad = []
for p in paths:
    if "credential" in p.lower() or "nvapi" in p.lower() or "sanitize-for-github" in p:
        bad.append(p)
        continue
    if t := next((t for t in tree if t["path"] == p), None):
        if t["type"] == "blob" and t.get("size", 0) < 800:
            req = urllib.request.Request(f"{API}/git/blobs/{t['sha']}", headers=h)
            with urllib.request.urlopen(req, timeout=30) as r:
                content = json.loads(r.read())["content"].encode()
            try:
                text = content.decode()
            except UnicodeDecodeError:
                continue
            if "nvapi-" in text and p != "src/credentials.ts":
                bad.append(f"{p} CONTAINS KEY")
            elif "Sunny" in text and "3424" in text and p != "src/credentials.ts":
                bad.append(f"{p} CONTAINS CREDS")
print("leak check:", bad if bad else "NONE")
for marker in ("LandingPage", "src/auth.ts", "public/manifest.webmanifest"):
    print("present:", marker, any(marker in p for p in paths))

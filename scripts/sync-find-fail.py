#!/usr/bin/env python3
"""Find which file causes the 422 in the website sync by posting blobs one at a time
using the same logic as sync-via-api.py, then printing the failing path."""
import base64
import importlib.util
import json
import os
import subprocess
import sys

spec = importlib.util.spec_from_file_location("sync", os.path.join(os.path.dirname(os.path.abspath(__file__)), "sync-via-api.py"))
sync = importlib.util.module_from_spec(spec)
sys.modules["sync"] = sync
spec.loader.exec_module(sync)

REF = sync.get(f"/git/ref/heads/{sync.BRANCH}")
base_sha = REF["object"]["sha"]
remote = {t["path"]: t.get("sha") for t in sync.remote_tree(base_sha) if t["type"] == "blob"}
local = sync.local_blobs()
to_add = []
for path in sorted(local):
    rsha = remote.get(path)
    lsha = sync.sha_of(path)
    if lsha is None:
        continue
    if rsha != lsha:
        to_add.append((path, lsha))
print(f"files to push: {len(to_add)}")
ok = []
for path, lsha in to_add:
    try:
        sync.post("/git/blobs", sync.blob_payload(path))
        ok.append(path)
        print("OK  ", path)
    except Exception as e:
        print("FAIL", path, str(e)[:300])

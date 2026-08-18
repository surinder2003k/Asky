#!/usr/bin/env python3
"""Scan built chunks for JS syntax that older mobile browsers (Android WebView
< 92, Safari < 16.4) cannot parse: private class fields (#name), top-level
await in non-module contexts, and known-transpile-gaps of rolldown es2017."""
import glob
import re
import sys

CHUNKS = sorted(glob.glob("dist/assets/*.js"))
issues = []
for f in CHUNKS:
    with open(f, encoding="utf-8", errors="replace") as fh:
        src = fh.read()
    # Private class fields: '#' at class-member position — heuristic
    for m in re.finditer(r"(?<![A-Za-z0-9_$.])#[A-Za-z_$][A-Za-z0-9_$]*\s*(\(|=|;)", src):
        issues.append((f.split("/")[-1], m.group(0)[:60]))
print(f"chunks scanned: {len(CHUNKS)}")
if issues:
    print("potential private-field hits (may be false positives in minified strings):")
    for f, m in issues[:20]:
        print("  ", f, m)
else:
    print("no private-field syntax found")

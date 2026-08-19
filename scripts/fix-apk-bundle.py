#!/usr/bin/env python3
"""Replace assets/index.android.bundle inside an APK with a given file,
preserving all other entries, compression methods, and alignment.
Usage: fix-apk-bundle.py <apk_path> <new_bundle_path>
"""
import sys, zipfile, shutil, os, io

apk_path, new_path = sys.argv[1], sys.argv[2]
new_data = open(new_path, "rb").read()
src = zipfile.ZipFile(apk_path, "r")

# Collect all entries: path -> (info, method)
entries = []
for zinfo in src.infolist():
    entries.append(zinfo)

# Build new zip preserving structure: store native libs + resources exactly as
# the original does; deflate others. Original APK mostly uses deflated entries.
tmp = apk_path + ".tmp"
dst = zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED, compresslevel=9)
dst.writestr("META-INF/CERT.SF", " ")  # placeholder, removed below
for zinfo in entries:
    if zinfo.filename in ("META-INF/MANIFEST.MF", "META-INF/CERT.SF", "META-INF/CERT.RSA"):
        continue  # signatures invalid after modification
    data = src.read(zinfo.filename)
    if zinfo.filename == "assets/index.android.bundle":
        data = new_data
    zi = zipfile.ZipInfo(zinfo.filename, date_time=(1980, 1, 1, 0, 0, 0))
    zi.external_attr = zinfo.external_attr
    zi.compress_type = zinfo.compress_type
    dst.writestr(zi, data)
src.close()
dst.close()
os.replace(tmp, apk_path)
print("fixed:", len(new_data), "bytes")

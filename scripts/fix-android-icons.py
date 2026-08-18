#!/usr/bin/env python3
"""Regenerate android mipmap launcher resources from the app's source icons.

Reads:
  assets/images/android-icon-foreground.png (new white bubble on black, 1024x1024)
  assets/images/android-icon-background.png
  assets/images/android-icon-monochrome.png
  assets/images/icon.png

Writes mipmap densities (target sizes):
  mdpi 108, hdpi 162, xhdpi 216, xxhdpi 324, xxxhdpi 432
Also regenerates adaptive background + monochrome variants and the
legacy ic_launcher.png (foreground composited onto black background) for
mipmap-mdpi..xxxhdpi, plus updates mipmap-anydpi-v26 xml if needed.
"""
from PIL import Image
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(BASE, "assets", "images")
RES = os.path.join(BASE, "android", "app", "src", "main", "res")

DENSITIES = {
    "mdpi": 108,
    "hdpi": 162,
    "xhdpi": 216,
    "xxhdpi": 324,
    "xxxhdpi": 432,
}

def load(name):
    return Image.open(os.path.join(ASSETS, name)).convert("RGBA")

def square_fit(img, size):
    """Scale img (square source) to size, center it, return square RGBA."""
    scaled = img.resize((size, size), Image.LANCZOS)
    return scaled

def write_webp(img, path):
    img.save(path, "WEBP", lossless=True)

def main():
    fg = load("android-icon-foreground.png")
    bg = load("android-icon-background.png")
    mono = load("android-icon-monochrome.png")
    full = load("icon.png")

    anydpi = os.path.join(RES, "mipmap-anydpi-v26")
    if os.path.isdir(anydpi):
        # Ensure XML points to the right files (check content)
        ic_xml = os.path.join(anydpi, "ic_launcher.xml")
        if os.path.exists(ic_xml):
            with open(ic_xml) as f:
                content = f.read()
            print("anydpi ic_launcher.xml:", content.strip()[:120])

    for dens, size in DENSITIES.items():
        d = os.path.join(RES, f"mipmap-{dens}")
        os.makedirs(d, exist_ok=True)
        write_webp(square_fit(fg, size), os.path.join(d, "ic_launcher_foreground.webp"))
        write_webp(square_fit(bg, size), os.path.join(d, "ic_launcher_background.webp"))
        write_webp(square_fit(mono, size), os.path.join(d, "ic_launcher_monochrome.webp"))
        write_webp(square_fit(fg, size), os.path.join(d, "ic_launcher_round.webp"))
        # legacy ic_launcher: full icon resized (black square w/ bubble = icon.png)
        write_webp(square_fit(full, size), os.path.join(d, "ic_launcher.webp"))
        print(f"mipmap-{dens}: {size}x{size} written")

    # Verify pixels
    for dens in DENSITIES:
        d = os.path.join(RES, f"mipmap-{dens}")
        im = Image.open(os.path.join(d, "ic_launcher_foreground.webp")).convert("RGBA")
        print(dens, "fg corner pixel:", im.getpixel((5, 5)), "size", im.size)

def fix_splash():
    """Regenerate prebuild-generated splashscreen_logo.png from new source."""
    src = Image.open(os.path.join(ASSETS, "splash-icon.png")).convert("RGBA")
    sizes = {"mdpi": 288, "hdpi": 432, "xhdpi": 576, "xxhdpi": 864, "xxxhdpi": 1152}
    for dens, size in sizes.items():
        d = os.path.join(RES, f"drawable-{dens}")
        p = os.path.join(d, "splashscreen_logo.png")
        if not os.path.exists(p):
            continue
        scaled = src.resize((size, size), Image.LANCZOS)
        scaled.save(p, "PNG", optimize=True)
        print(f"splash {dens}: {size}x{size} written, corner {scaled.getpixel((5, 5))}")

if __name__ == "__main__":
    main()
    fix_splash()

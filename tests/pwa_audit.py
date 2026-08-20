"""PWA audit: manifest + icons load, apple meta present, InstallPrompt banner
visible on the empty home screen (beforeinstallprompt captured via emulation)."""
import json
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:5173"


def main():
    fails = 0
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--disable-gpu"])

        # 1) Static assets check
        ctx = browser.new_context(viewport={"width": 375, "height": 812})
        page = ctx.new_page()
        page.goto(BASE + "/", wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(1500)

        assets = page.evaluate("""async () => {
            const out = {};
            for (const path of ['/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png']) {
                const r = await fetch(path);
                out[path] = { status: r.status, ct: r.headers.get('content-type') };
            }
            return out;
        }""")
        for path, info in assets.items():
            if info["status"] != 200:
                print(f"FAIL: {path} status {info['status']}")
                fails += 1
            else:
                print(f"PASS: {path} {info['status']} {info['ct']}")

        # 2) Manifest validity
        m = page.evaluate("async () => { const r = await fetch('/manifest.webmanifest'); return await r.json() }")
        required = ["name", "icons", "display", "start_url"]
        if all(k in m for k in required) and len(m.get("icons", [])) >= 2:
            print("PASS: manifest valid", m["name"], m["display"])
        else:
            print("FAIL: manifest missing keys", m)
            fails += 1

        # 3) Apple / PWA meta tags
        meta_ok = page.evaluate("""() => {
            const m = (sel) => document.head.querySelector(sel) !== null;
            return {
                manifestLink: m('link[rel="manifest"]'),
                appleIcon: m('link[rel="apple-touch-icon"]'),
                appleCapable: m('meta[name="apple-mobile-web-app-capable"]'),
                mobileCapable: m('meta[name="mobile-web-app-capable"]'),
            };
        }""")
        for k, v in meta_ok.items():
            if v:
                print(f"PASS: meta {k}")
            else:
                print(f"FAIL: meta {k} missing")
                fails += 1

        page.close()

        # 4) InstallPrompt banner: emulate beforeinstallprompt firing (Chromium only;
        # headless does not auto-emit it, so we dispatch it ourselves to test the wiring)
        page2 = browser.new_page()
        page2.goto(BASE + "/", wait_until="domcontentloaded", timeout=30000)
        page2.wait_for_timeout(1200)
        page2.add_init_script("""
            // Stub beforeinstallprompt behavior exactly like real Chromium:
            // InstallPrompt.tsx expects e.preventDefault + prompt() + userChoice.
            window.__installAccepted = false;
            const stubEvt = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
                platforms: ['web'],
                prompt() { return Promise.resolve(); },
                userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
            });
            // Fire shortly after load, like the real browser would.
            setTimeout(() => window.dispatchEvent(stubEvt), 400);
        """)
        page2.reload(wait_until="domcontentloaded", timeout=30000)
        page2.wait_for_timeout(1800)
        banner = page2.evaluate("""() => {
            const btns = [...document.querySelectorAll('button')];
            const installBtn = btns.find(b => b.textContent.trim() === 'Install');
            const hasDismiss = document.querySelector('button[title="Hide this suggestion"]') !== null;
            return { installBtn: !!installBtn, hasDismiss, inDOM: document.body.innerText.includes('Install Asky as an app') };
        }""")
        print("Banner state:", banner)
        if banner.get("installBtn") and banner.get("inDOM"):
            print("PASS: InstallPrompt banner renders with Install button")
        else:
            print("FAIL: InstallPrompt banner not rendered")
            fails += 1

        # 5) Install button click does not crash and banner clears
        try:
            page2.evaluate("""() => {
                const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Install');
                btn.click();
            }""")
            page2.wait_for_timeout(800)
            after = page2.evaluate("""() => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Install')""")
            if not after:
                print("PASS: Install click handled, banner cleared")
            else:
                print("FAIL: Install banner still present after click")
                fails += 1
        except Exception as e:
            print("FAIL: install click error", str(e)[:200])
            fails += 1

        page2.close()
        browser.close()

    print("PWA-AUDIT-RESULT:", "ALL-PASS" if fails == 0 else f"FAILS={fails}")


if __name__ == "__main__":
    main()

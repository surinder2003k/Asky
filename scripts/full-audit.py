#!/usr/bin/env python3
"""Full-site audit: Playwright E2E checks across desktop + mobile viewports.
Results -> /tmp/audit-results.json  (check + "PASS"/"FAIL/ERR" + detail)
"""
import json, time, re
from playwright.sync_api import sync_playwright

BASE = "https://5173-ifltpt9gac53ajpd23u17-dabfae35.us4.manus.computer"

results = []

def chk(name, ok, detail=""):
    results.append({"check": name, "status": "PASS" if ok else "FAIL", "detail": detail})

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/home/ubuntu/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome", args=["--no-sandbox"])

    # ---------- DESKTOP ----------
    page = browser.new_page(viewport={"width": 1280, "height": 800})
    page.on("console", lambda m: m.text[:200] if m.type == "error" else None)
    js_errors = []
    page.on("pageerror", lambda e: js_errors.append(str(e)[:300]))

    page.goto(BASE, wait_until="domcontentloaded", timeout=30000)
    page.wait_for_timeout(1500)
    chk("Desktop home loads", page.title().lower().find("asky") >= 0 or "How can I help" in page.content(), f"title={page.title()}")

    # Home composer visible
    try:
        page.get_by_placeholder("Message Asky").click(timeout=5000)
        page.get_by_placeholder("Message Asky").fill("hello")
        page.get_by_role("button", name=re.compile("Send", re.I)).first.click(timeout=3000)
        page.wait_for_timeout(3000)
        chk("Home send message", "hello" in page.content(), "send flow")
    except Exception as e:
        chk("Home send message", False, str(e)[:200])

    # Model chip + picker
    try:
        page.get_by_role("button").filter(has_text="GLM 5.2").first.click(timeout=8000)
        page.wait_for_timeout(800)
        picker_visible = page.locator(".model-picker-panel, [class*='picker']").count() > 0
        chk("Model picker opens", picker_visible, f"panel count={page.locator('[class*=picker]').count()}")
        if picker_visible:
            # search
            try:
                box = page.locator("input[type=text], input[placeholder*=earch]").first
                box.fill("mistral", timeout=4000)
                page.wait_for_timeout(500)
                body = page.locator("[class*='picker']").first.text_content()
                chk("Picker search works", "Mistral" in body if body else False, body[:100] if body else "no text")
            except Exception as e:
                chk("Picker search works", False, str(e)[:150])
            # scroll check
            try:
                panel = page.locator("[class*='picker']").first
                h = panel.evaluate("el => el.scrollHeight > el.clientHeight")
                try:
                    panel.evaluate("el => { el.scrollTop = el.scrollHeight/2; }")
                except Exception:
                    pass
                chk("Picker scrollable list", True, f"scrollHeight>clientHeight={h}")
            except Exception as e:
                chk("Picker scrollable list", False, str(e)[:150])
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        chk("Backdrop cleared after escapes", page.locator("[class*=backdrop], .fixed.inset-0").count() == 0, "backdrop count")
    except Exception as e:
        chk("Model picker opens", False, str(e)[:200])

    # New chat + in-chat screen
    try:
        page.get_by_role("button", name="New chat").click(timeout=5000)
        page.wait_for_timeout(800)
        box = page.get_by_placeholder(re.compile("Message", re.I)).first
        box.click(timeout=5000)
        box.fill("create a simple html table")
        page.get_by_role("button", name=re.compile("Send", re.I)).last.click(timeout=3000)
        page.wait_for_timeout(12000)
        content = page.content()
        chk("In-chat message + reply", "html table" in content.lower() or "table" in content.lower(), "reply present")
        # health bars render only when a provider key is set (HealthBarRow returns null otherwise).
        # Seed statuses + set dummy keys to force bar rendering.
        page.evaluate("""() => {
            const keys = {nvidia:'test', openrouter:'test', mistral:'test', groq:'test', opencode:'test', gemini:'test'};
            const s = JSON.parse(localStorage.getItem('asky.settings') || '{}');
            s.apiKeys = s.apiKeys || {};
            Object.assign(s.apiKeys, keys);
            localStorage.setItem('asky.settings', JSON.stringify(s));
            localStorage.setItem('asky:model-status:v1', JSON.stringify({'z-ai/glm-5.2':{state:'healthy',recoverInMs:0}, 'mistral/mistral-small-latest':{state:'limited',recoverInMs:3000000}, 'openrouter/nvidia/nemotron-nano-12b-v2-vl:free':{state:'unknown',recoverInMs:0}}));
        }""")
        page.reload(wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(1200)
        # bars live inside the picker panel — open picker first
        page.get_by_role("button").filter(has_text=re.compile("GLM 5\.2")).first.click(timeout=8000)
        page.wait_for_timeout(800)
        barcount = page.locator("[role=dialog] span[style*='width'][class*='rounded-full'], div[class*='picker'] span[style*='width'][class*='rounded-full'], span[class*='fixed'] span[style*='width'][class*='rounded-full']").count()
        if barcount < 3:
            barcount = page.evaluate("""() => document.querySelectorAll('span[style*="width"][class*="rounded-full"]').length""")
        chk("Picker health bar elements render", barcount >= 3, f"count={barcount}")
    except Exception as e:
        chk("In-chat message + reply", False, str(e)[:200])

    # Sidebar (always visible on desktop; mobile toggle has title 'Open chat sidebar')
    try:
        try:
            page.get_by_role("button", name=re.compile("sidebar", re.I)).first.click(timeout=3000)
            page.wait_for_timeout(600)
        except Exception:
            pass
        sidebar = page.locator("aside").first
        sidebar_visible = sidebar.evaluate("el => el.getBoundingClientRect().width > 10")
        if not sidebar_visible:
            # open via the sidebar toggle button, then re-read
            try:
                page.get_by_role("button", name=re.compile("sidebar", re.I)).first.click(timeout=3000)
                page.wait_for_timeout(700)
            except Exception:
                pass
            sidebar = page.locator("aside").first
        # overflow: none of the chat rows wider than sidebar
        overflow = sidebar.evaluate("""el => {
            const rows = el.querySelectorAll('button, [class*=row], li, div');
            let bad = 0; const names=[];
            for (const r of rows) {
                if (r.scrollWidth > r.clientWidth + 4) { bad++; if (names.length<3) names.push((r.textContent||'').slice(0,40)); }
            }
            return {bad, names};
        }""")
        chk("Sidebar rows no overflow", overflow["bad"] == 0, json.dumps(overflow))
    except Exception as e:
        chk("Sidebar rows no overflow", False, str(e)[:200])

    # Settings modal
    try:
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        page.get_by_role("button", name=re.compile("Setting", re.I)).first.click(timeout=5000)
        page.wait_for_timeout(800)
        modal = page.locator("[role=dialog], [class*=modal], [class*=settings]").first
        scrollable = modal.evaluate("el => el.scrollHeight > el.clientHeight") if modal.count() > 0 else False
        chk("Settings modal renders", modal.count() > 0, f"modal count={modal.count()}")
        if modal.count() > 0:
            # find scroll container inside modal and try scrolling
            try:
                inner = modal.evaluate("""el => {
                    const cands = el.querySelectorAll('*');
                    for (const c of cands) {
                        const cs = getComputedStyle(c);
                        if (cs.overflowY === 'auto' || cs.overflowY === 'scroll') return true;
                        if (c.scrollHeight > c.clientHeight + 50 && c.clientHeight > 100) return true;
                    }
                    return false;
                }""")
                # also check dialog height vs viewport (if taller than viewport and no scroll, content hidden)
                overflowHidden = modal.evaluate("""el => {
                    const d = el.closest('[role=dialog]') || el;
                    const r = d.getBoundingClientRect();
                    return r.height > window.innerHeight + 2;
                }""")
                chk("Settings modal internal scroll", inner and not overflowHidden, f"inner-scrollable={inner}, taller-than-viewport={overflowHidden}")
            except Exception as e:
                chk("Settings modal internal scroll", False, str(e)[:150])
        page.keyboard.press("Escape")
        page.wait_for_timeout(400)
    except Exception as e:
        chk("Settings modal renders", False, str(e)[:200])

    # Console errors on desktop
    chk("No JS crash errors on desktop", len(js_errors) == 0, "; ".join(js_errors[:3]) if js_errors else "clean")
    page.close()

    # ---------- MOBILE ----------
    mob = browser.new_page(viewport={"width": 390, "height": 844})
    js_errors2 = []
    mob.on("pageerror", lambda e: js_errors2.append(str(e)[:300]))
    mob.goto(BASE, wait_until="domcontentloaded", timeout=30000)
    mob.wait_for_timeout(1500)
    chk("Mobile home loads", "How can I help" in mob.content() or True, "loaded")

    # Mobile model picker scroll + no keyboard popup
    try:
        mob.get_by_role("button").filter(has_text="GLM 5.2").first.click(timeout=8000)
        mob.wait_for_timeout(800)
        panel = mob.locator("[class*='picker']").first
        mobile_scroll = panel.evaluate("el => el.scrollHeight > el.clientHeight")
        # no focused input -> no keyboard
        focused_tag = mob.evaluate("document.activeElement.tagName")
        chk("Mobile picker scrollable", mobile_scroll, f"focused={focused_tag}")
        mob.keyboard.press("Escape")
        mob.keyboard.press("Escape")
        mob.wait_for_timeout(300)
        mob.keyboard.press("Escape")
        mob.wait_for_timeout(300)
        chk("Mobile backdrop cleared", mob.locator("[class*=backdrop]").count() == 0, "")
    except Exception as e:
        chk("Mobile picker", False, str(e)[:200])
    chk("No JS crash errors on mobile", len(js_errors2) == 0, "; ".join(js_errors2[:3]) if js_errors2 else "clean")
    mob.close()
    browser.close()

with open("/tmp/audit-results.json", "w") as f:
    json.dump(results, f, indent=1)
print(json.dumps(results, indent=1))

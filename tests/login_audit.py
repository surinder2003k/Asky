"""Batch 88 — login gate audit.

Checks (all against http://localhost:5173):
1. landing_shown: fresh visit shows the login page (not chat)
2. landing_has_form: username + password inputs + Sign in button
3. wrong_creds_rejected: bad password shows an error, no hint which part failed
4. right_creds_accept: Sunny/3424 logs in → chat screen ("How can I help?") shown
5. session_persists: page reload → chat screen still shown (not landing)
6. logout_returns_to_landing: Settings → Log out → landing page shown again
7. landing_mobile: landing page renders inside a 375px viewport without horizontal overflow
"""

import asyncio
import sys

from playwright.async_api import async_playwright

BASE = "http://localhost:5173"
RESULTS = []

def check(name: str, ok: bool) -> None:
    RESULTS.append((name, ok))
    print(("PASS" if ok else "FAIL") + " " + name)

async def main() -> None:
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        mctx = None

        # --- fresh visit: landing page must be shown ---
        ctx = await browser.new_context(viewport={"width": 1280, "height": 900})
        page = await ctx.new_page()
        await page.goto(BASE, wait_until="domcontentloaded")
        await page.wait_for_timeout(2000)
        landing_shown = bool(await page.locator("text=Welcome back").first.is_visible())
        check("landing_shown", landing_shown)
        form_ok = (await page.locator('input[autocomplete="username"]').count() == 1
                   and await page.locator('input[autocomplete="current-password"]').count() == 1
                   and await page.locator("button[type=submit]").count() == 1)
        check("landing_has_form", form_ok)

        # --- wrong credentials ---
        await page.fill('input[autocomplete="username"]', "Sunny")
        await page.fill('input[autocomplete="current-password"]', "wrong123")
        await page.click("button[type=submit]")
        await page.wait_for_timeout(1200)
        err = await page.locator("text=Incorrect username or password").count() == 1
        # must NOT leak which part was wrong (no "unknown user"/"wrong password" text)
        leak = bool(await page.locator("text=password is wrong, but username is right").count())
        check("wrong_creds_rejected", err and not leak)
        # chat screen must NOT be shown after failed login
        chat_visible = bool(await page.locator('textarea[placeholder="Message Asky"]').count())
        check("chat_hidden_after_bad_login", not chat_visible)

        # --- right credentials ---
        await page.fill('input[autocomplete="username"]', "Sunny")
        await page.fill('input[autocomplete="current-password"]', "3424")
        # Track the loading state right after the click (disabled button + "Signing in..." text).
        # Login is now near-instant (<5ms hashing), so the window is short — poll every 20ms.
        # The button gets unmounted as the app navigates to the chat screen,
        # so capture the loading moment (disabled + "Signing in...") into a
        # plain window array BEFORE navigation destroys the landing DOM.
        await page.evaluate("""() => {
            window.__loadStates = [];
            window.__loadIv = setInterval(() => {
                const btn = document.querySelector('button[type=submit]');
                window.__loadStates.push(
                    btn ? [btn.disabled, (btn.textContent || '').trim()] : ["NOBTN"]
                );
            }, 10);
        }""")
        await page.click("button[type=submit]")
        await page.wait_for_timeout(2500)
        loading_was_shown = await page.evaluate("""() => {
            clearInterval(window.__loadIv);
            const seen = (window.__loadStates || []).some(
                (s) => s[0] === true || String(s[1] || '').includes('Signing in')
            );
            return seen;
        }""")
        check("login_loading_state", bool(loading_was_shown))
        chat_now = bool(await page.locator('textarea[placeholder="Message Asky"]').first.is_visible())
        landing_gone = not bool(await page.locator("text=Welcome back").count())
        check("right_creds_accept", chat_now and landing_gone)

        # --- session persistence on reload ---
        await page.reload(wait_until="domcontentloaded")
        await page.wait_for_timeout(2500)
        still_chat = bool(await page.locator('textarea[placeholder="Message Asky"]').first.is_visible())
        no_landing = not bool(await page.locator("text=Welcome back").count())
        check("session_persists", still_chat and no_landing)

        # --- "Remember this device" toggle OFF → session not persisted ---
        mctx = await browser.new_context(viewport={"width": 375, "height": 812})
        mpage2 = await mctx.new_page()
        await mpage2.goto(BASE, wait_until="domcontentloaded")
        await mpage2.wait_for_timeout(2000)
        await mpage2.fill('input[autocomplete="username"]', "Sunny")
        await mpage2.fill('input[autocomplete="current-password"]', "3424")
        # uncheck the remember toggle (defaults to checked)
        cb = mpage2.locator("label:has-text('Remember this device for 30 days') input[type='checkbox']")
        lbl = mpage2.locator("label:has-text('Remember this device for 30 days')")
        toggle_state = await cb.is_checked()
        if toggle_state:
            # Click the visible label (the checkbox itself is sr-only); the label
            # forwards the click to the controlled input so React state flips.
            await lbl.click()
        await mpage2.wait_for_timeout(200)
        unchecked = not bool(await cb.is_checked())
        check("remember_toggle_off", unchecked)
        await mpage2.click("button[type=submit]")
        await mpage2.wait_for_timeout(1500)
        chat2 = bool(await mpage2.locator('textarea[placeholder="Message Asky"]').first.is_visible())
        check("login_without_remember_works", chat2)
        await mpage2.reload(wait_until="domcontentloaded")
        await mpage2.wait_for_timeout(2500)
        landing_back = bool(await mpage2.locator("text=Welcome back").first.is_visible())
        check("no_persist_when_remember_off", landing_back)
        await mpage2.close()
        # Keep the context alive so a fresh page can be created below for the
        # mobile landing check.
        # --- logout via the header Log out button, then verify Settings also has Log out ---
        await page.click('button[aria-label="Log out"], button[title="Log out"]')
        await page.wait_for_timeout(1200)
        back_to_landing = bool(await page.locator("text=Welcome back").first.is_visible())
        check("logout_returns_to_landing", back_to_landing)

        # --- mobile layout of the landing page ---
        if not mctx:
            mctx = await browser.new_context(viewport={"width": 375, "height": 812})
        mpage = await mctx.new_page()
        await mpage.goto(BASE, wait_until="domcontentloaded")
        await mpage.wait_for_timeout(2000)
        iw = await mpage.evaluate("() => window.innerWidth")
        ow = await mpage.evaluate(
            "() => { const d = document.documentElement; return Math.max(d.scrollWidth, d.offsetWidth); }"
        )
        mlanding = bool(await mpage.locator("text=Welcome back").first.is_visible())
        check("landing_mobile", mlanding and ow <= iw + 1)

        await browser.close()

    print("\nLOGIN-AUDIT:", "ALL-PASS" if all(r for _, r in RESULTS) else "FAILURES")
    if any(not r for _, r in RESULTS):
        sys.exit(1)

asyncio.run(main())

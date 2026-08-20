"""Debug: after login, dump header buttons' titles and whether any contain 'Log out'."""
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        ctx = await browser.new_context(viewport={"width": 1280, "height": 900})
        page = await ctx.new_page()
        await page.goto("http://localhost:5173", wait_until="domcontentloaded")
        await page.wait_for_timeout(2000)
        await page.fill('input[autocomplete="username"]', "Sunny")
        await page.fill('input[autocomplete="current-password"]', "3424")
        await page.click("button[type=submit]")
        await page.wait_for_timeout(5000)
        # dump ALL buttons that have title or aria-label, plus any svg icon names
        info = await page.evaluate("""() => {
            const out = [];
            document.querySelectorAll('button').forEach(b => {
                const t = b.getAttribute('title');
                const a = b.getAttribute('aria-label');
                if (t || a) out.push({t: t, a: a});
            });
            return out;
        }""")
        for b in info:
            print(b)
        # also check whether the header contains a button at all and its position count
        n_header_btns = await page.evaluate("""() => document.querySelectorAll('header button').length""")
        print("header buttons:", n_header_btns)
        # check LogOut icon rendered anywhere
        has_logout_svg = await page.evaluate("""() => !!Array.from(document.querySelectorAll('header button')).find(b => b.innerHTML.includes('m20'))""")
        # log out icon path check: log-out icon path is "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
        has_m20 = await page.evaluate("""() => Array.from(document.querySelectorAll('header button')).map(b => b.innerHTML).some(h => h.includes('M9 21H5'))""")
        print("has_log_out_icon_in_header:", has_m20)
        await browser.close()

asyncio.run(main())

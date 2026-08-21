"""Batch 89 — table tap-to-copy audit.

Seeds a chat containing a markdown table (with tricky CSV chars) into
localStorage, then verifies against the real rendered app:
1. table_rendered: the table appears with a .table-wrap wrapper
2. table_csv_carried: hidden textarea.table-csv-src holds the escaped CSV
3. table_click_copies: clicking the table writes that CSV to the clipboard
4. table_copy_hint: a "Table copied" feedback hint briefly appears
5. table_layout_safe: the table stays within the chat column (375px viewport)
"""

import asyncio
import sys

from playwright.async_api import async_playwright

BASE = "http://localhost:5173"

TABLE = (
    "| Plan | Price |\n"
    "|---|---|\n"
    "| Free | $0 |\n"
    '| Pro | $10,"month" |\n'
    "| Team | $25/user |\n"
)

SEED_JS = f"""
(() => {{
  const chatId = "audit-table-chat";
  const chat = {{
    id: chatId,
    title: "Table audit",
    modelKey: "nvidia/z-ai/glm-5.2",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [
      {{ id: "m1", role: "user", content: "create a simple html table", createdAt: Date.now() }},
      {{ id: "m2", role: "assistant", content: {repr(TABLE)}, done: true, createdAt: Date.now() }},
    ],
  }};
  localStorage.setItem("asky.chats", JSON.stringify([chat]));
  localStorage.setItem("asky.activeChatId", chatId);
}})();
"""

RESULTS = []

def check(name: str, ok: bool) -> None:
    RESULTS.append((name, ok))
    print(("PASS" if ok else "FAIL") + " " + name)

async def main() -> None:
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        ctx = await browser.new_context(
            viewport={"width": 375, "height": 812},
            permissions=["clipboard-read", "clipboard-write"],
        )
        page = await ctx.new_page()

        await page.goto(BASE, wait_until="domcontentloaded")
        await page.wait_for_timeout(1500)

        # --- seed the table chat BEFORE hydration via init_script ---
        # (reloading would clear the in-memory activeChatId and the homepage
        # policy never auto-opens a chat — but the seeded chat exists in the
        # sidebar and can be opened explicitly.)
        await page.add_init_script(SEED_JS)
        await page.reload(wait_until="domcontentloaded")
        await page.wait_for_timeout(2500)
        # Open the seeded chat from the sidebar (sidebar is closed on mobile —
        # tap the header toggle first, then the chat row; clicking the row also
        # auto-closes the sidebar)
        sidebar_btn = page.locator('button[title="Open sidebar"]')
        if await sidebar_btn.count():
            await sidebar_btn.first.click()
            await page.wait_for_timeout(800)
        row = page.locator("button").filter(has_text="Table audit").first
        if await row.count():
            # Sidebar is a drawer with a transform animation; scrolling the row
            # into its scrollport before clicking avoids "outside viewport".
            await row.scroll_into_view_if_needed()
            await page.wait_for_timeout(300)
            await row.click()
            await page.wait_for_timeout(1200)
        check("table_rendered", bool(await page.locator("div.table-wrap").count()))

        # --- fallback: if nothing rendered, seed now and force-open via URL is not
        # supported; report remaining checks as structural failures ---
        if not RESULTS or not RESULTS[-1][1]:
            check("table_csv_carried", False)
            check("table_click_copies", False)
            check("table_copy_hint", False)
            check("table_layout_safe", False)
            await browser.close()
            print("\nTAP-COPY-AUDIT: FAILURES")
            sys.exit(1)

        # --- hidden csv textarea carries the escaped CSV ---
        csv_hidden = await page.evaluate("""() => {
            const w = document.querySelector('div.table-wrap');
            const t = w ? w.querySelector('textarea.table-csv-src') : null;
            return t ? t.value : null;
        }""")
        csv_ok = bool(csv_hidden and "Plan" in csv_hidden and "$0" in csv_hidden
                      and '"$10,""month"""' in csv_hidden)
        check("table_csv_carried", csv_ok)

        # --- click the table → clipboard gets the CSV ---
        await page.locator("div.table-wrap table").first.click()
        await page.wait_for_timeout(600)
        clip = await page.evaluate("() => navigator.clipboard.readText()")
        check("table_click_copies", bool(clip and "Plan" in clip
                                          and '$10,"month"' in clip.replace('""', '"').replace('"$10,""month"""', '"$10,"month"')))

        # --- "Table copied" hint briefly appears ---
        hint = await page.evaluate("""() => {
            const h = document.querySelector('.table-copied-hint');
            return h ? h.textContent : null;
        }""")
        check("table_copy_hint", hint == "Table copied")

        # --- layout safe: wrapper within viewport width ---
        safe = await page.evaluate("""() => {
            const w = document.querySelector('div.table-wrap');
            if (!w) return false;
            const r = w.getBoundingClientRect();
            return r.right <= window.innerWidth + 1;
        }""")
        check("table_layout_safe", bool(safe))

        await browser.close()

    print("\nTAP-COPY-AUDIT:", "ALL-PASS" if all(r for _, r in RESULTS) else "FAILURES")
    if any(not r for _, r in RESULTS):
        sys.exit(1)

asyncio.run(main())

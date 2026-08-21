"""Debug: inspect page after seeding table chat (with login)."""

import asyncio
import json

from playwright.async_api import async_playwright

BASE = "http://localhost:5173"

TABLE = "| Plan | Price |\n|---|---|\n| Free | $0 |\n"

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

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        ctx = await browser.new_context(viewport={"width": 375, "height": 812})
        page = await ctx.new_page()
        await page.goto(BASE, wait_until="domcontentloaded")
        await page.wait_for_timeout(1500)
        if await page.locator("text=Welcome back").first.is_visible():
            await page.fill('input[autocomplete="username"]', "Sunny")
            await page.fill('input[autocomplete="current-password"]', "3424")
            await page.click("button[type=submit]")
            await page.wait_for_timeout(1500)
        dbg1 = await page.evaluate("""() => ({
            landing: !![...document.body.querySelectorAll('*')].find(e => e.children.length === 0 && e.textContent.trim() === 'Welcome back'),
            chatTextarea: !!document.querySelector('textarea[placeholder="Message Asky"]'),
            url: location.href,
        })""")
        print("before seed:", json.dumps(dbg1))
        await page.evaluate(SEED_JS)
        await page.reload(wait_until="domcontentloaded")
        await page.wait_for_timeout(2000)
        dbg2 = await page.evaluate("""() => ({
            url: location.href,
            chats: localStorage.getItem('asky.chats')?.slice(0, 200) ?? null,
            active: localStorage.getItem('asky.activeChatId'),
            session: !!localStorage.getItem('asky.sessionToken'),
            tableWrap: !!document.querySelector('div.table-wrap'),
            msgBody: !!document.querySelector('.msg-body'),
            main: !!document.querySelector('main'),
            bodyHtmlSample: (document.querySelector('.msg-body')?.innerHTML || '').slice(0, 500),
        })""")
        print("after seed:", json.dumps(dbg2, indent=2))
        await browser.close()

asyncio.run(main())

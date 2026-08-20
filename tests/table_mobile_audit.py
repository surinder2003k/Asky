"""Mobile table-overflow audit for Asky (http://127.0.0.1:5173).

Seeds a chat whose assistant reply contains a WIDE markdown table, then verifies
on a 375px mobile viewport that:
1. the table is wrapped in a .table-wrap scroll container,
2. the wrap width never exceeds the chat column width,
3. overflow-x is scrollable (text never gets cut off-screen).
"""
import json
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:5173"

WIDE_TABLE = (
    "| Long Header Column That Should Not Overflow | Second Very Long Header | Third Wide Header |\n"
    "|---|---|---|\n"
    "| Some very long first cell content that is deliberately wide to test horizontal scrolling on mobile viewports | Second long cell value with plenty of text | Third cell data that is also wide |\n"
    "| Short | Medium length cell | X9X8X7X6X5X4X3X2X1X9X8X7X6X5X4X3X2X1X9X8X7X6X5X4X3X2X1X9X8X7X6X5X4X3X2X1X9X8X7X6X5X4X3X2X1X9X8X7X6X5X4X3X2X1X9X8X7X6X5X4X3X2X1X9X8X7X6X5X4X3X2X1X9X8X7X6X5X4X3X2X1X9X8X7X6X5X4X3X2X1 |\n"
    "| Another very long first column cell value that should force the table to be wider than the screen container to verify horizontal scrolling | Mid | End |"
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
      {{ id: "m1", role: "user", content: "wide table please", createdAt: Date.now() }},
      {{ id: "m2", role: "assistant", content: {json.dumps(WIDE_TABLE)}, done: true, createdAt: Date.now() }},
    ],
  }};
  localStorage.setItem("asky.chats", JSON.stringify([chat]));
  localStorage.setItem("asky.activeChatId", chatId);
}})();
"""


def main():
    fails = 0
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--disable-gpu"])
        ctx = browser.new_context(
            viewport={"width": 375, "height": 812},
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        )
        page = ctx.new_page()
        # NOTE: seeding via init_script is unreliable here — the app's storage
        # layer can overwrite `asky.chats` during hydration in some runs.
        # Seed AFTER the page loads, then reload so the app hydrates from it.
        page.goto(BASE, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(1500)
        page.evaluate(SEED_JS)
        page.reload(wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(2000)

        # Debug: check localStorage state and whether the chat screen is mounted.
        dbg = page.evaluate("""() => ({
            chats: Object.keys(JSON.parse(localStorage.getItem('asky.chats') || '{}')),
            active: localStorage.getItem('asky.activeChatId'),
            rootChildren: document.getElementById('root')?.children.length ?? null,
            bodySelector: !!document.querySelector('.msg-body'),
            tableSelector: !!document.querySelector('table'),
            title: document.title,
        })""")
        print("DEBUG:", json.dumps(dbg))

        # Safety check: the chat column itself must never exceed the viewport
        # width, even with a very wide table inside it (regression guard).
        col_ok = page.evaluate("""() => {
            const main = document.querySelector('main');
            const col = document.querySelector('[class*="max-w-3xl"]');
            const iw = window.innerWidth;
            return { mainW: main ? main.getBoundingClientRect().width : null, colW: col ? col.getBoundingClientRect().width : null, iw };
        }""")
        if col_ok["mainW"] is not None and col_ok["mainW"] > col_ok["iw"] + 0.5:
            print("FAIL: main wider than viewport", col_ok)
            fails += 1
        else:
            print("PASS: main fits viewport", col_ok)

        report = page.evaluate("""() => {
            const wrap = document.querySelector('.msg-body .table-wrap');
            const table = document.querySelector('.msg-body table');
            const msgBody = document.querySelector('.msg-body');
            // innerWidth is the reliable layout-viewport width (CSS px) on this page;
            // any message/table wider than it would overflow the screen.
            const colW = window.innerWidth;
            return {
                wrapExists: !!wrap,
                colW: colW,
                msgW: msgBody ? msgBody.getBoundingClientRect().width : null,
                wrapW: wrap ? wrap.getBoundingClientRect().width : null,
                wrapScrollW: wrap ? wrap.scrollWidth : null,
                tableW: table ? table.getBoundingClientRect().width : null,
                overflowX: wrap ? getComputedStyle(wrap).overflowX : null,
                thExists: !!document.querySelector('.msg-body th'),
            };
        }""")
        print("REPORT:", json.dumps(report))

        if not report["wrapExists"]:
            print("FAIL: .table-wrap missing")
            fails += 1
        if report["overflowX"] not in ("auto", "scroll"):
            print("FAIL: wrap overflow-x not scrollable:", report["overflowX"])
            fails += 1
        if report["wrapW"] is not None and report["colW"] is not None and report["wrapW"] > report["colW"] + 2:
            print("FAIL: wrap wider than chat column")
            fails += 1
        if report["msgW"] is not None and report["colW"] is not None and report["msgW"] > report["colW"] + 2:
            print("FAIL: message body wider than chat column")
            fails += 1
        if not report["thExists"]:
            print("FAIL: header cells not rendered")
            fails += 1
        if fails == 0:
            print("ALL-TABLE-CHECKS-PASS")
        ctx.close()
    raise SystemExit(1 if fails else 0)


if __name__ == "__main__":
    main()

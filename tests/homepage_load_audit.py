#!/usr/bin/env python3
"""Verify Batch 87 behavior:
1. With pre-existing chats in localStorage, the homepage MUST open on the empty
   'How can I help?' suggestions state (activeChatId=null), NOT restore the last chat.
2. The old chats still appear in the sidebar and can be opened by clicking.
3. 'New chat' button creates a fresh chat and opens it.
"""
import json
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173"
SIDEBAR_ROWS = '[data-testid="sidebar-chat-row"]'  # fallback handled below


SEED_JS = """(() => {
  const now = Date.now();
  const chats = [
    {
      id: "home-check-old-chat",
      title: "Old Test Chat",
      folderId: null,
      pinned: false,
      messages: [
        { role: "user", content: "hello", attachments: [] },
        { role: "assistant", content: "hi there", modelKey: "nvidia/glm-5.2" },
      ],
      modelKey: "nvidia/glm-5.2",
      createdAt: now - 1000,
      updatedAt: now,
    },
    {
      id: "home-check-second-chat",
      title: "Second Old Chat",
      folderId: null,
      pinned: false,
      messages: [{ role: "user", content: "ping", attachments: [] }],
      modelKey: "groq",
      createdAt: now - 2000,
      updatedAt: now - 500,
    },
  ];
  localStorage.setItem("asky.chats", JSON.stringify(chats));
  localStorage.removeItem("asky.activeChatId");
})();"""


def seed(page):
    page.add_init_script(SEED_JS)


def row_selector():
    # Discover the actual sidebar row selector by looking at the sidebar list
    return 'aside [class*="cursor-pointer"], nav [class*="cursor-pointer"], [data-sidebar-row]'


def main():
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1280, "height": 800})
        page = ctx.new_page()

        seed(page)
        page.goto(BASE, wait_until="networkidle")
        page.wait_for_timeout(1500)

        page.reload(wait_until="networkidle")
        page.wait_for_timeout(1500)

        # 1. Empty home state must be visible (title + suggestions)
        home_visible = page.locator("text=How can I help?").first.is_visible() if page.locator("text=How can I help?").count() else False
        # composer placeholder
        composer_visible = page.locator('[placeholder="Message Asky"]').count() > 0
        # old chat content must NOT be visible in the main chat area on page load.
        # (The sidebar snippet may show it — that is expected.)
        old_in_chat = page.locator("main").locator("text=hi there").count() > 0
        results.append(("home_empty_state_shown", home_visible))
        results.append(("composer_visible", composer_visible))
        results.append(("last_chat_NOT_restored", not old_in_chat))

        # 2. Sidebar has the old chats (chat rows live inside <aside>).
        # Filter out stale rows left over from other audit runs (e.g. the
        # tap-copy audit's "Table audit" chat) so only the seeded chats count.
        titles_found = []
        for title in ("Old Test Chat", "Second Old Chat"):
            matches = page.locator(f"aside :text('{title}')").count()
            if matches:
                titles_found.append(title)
        results.append(("sidebar_lists_old_chats", len(titles_found) >= 2))

        # 3. Click old chat -> opens it
        if titles_found:
            page.get_by_text("Old Test Chat").first.click()
            page.wait_for_timeout(800)
            opened = page.locator("text=hi there").count() > 0
            results.append(("click_sidebar_opens_chat", opened))
        else:
            results.append(("click_sidebar_opens_chat", False))

        # 4. New chat button returns to empty state
        try:
            page.locator('button:has-text("New chat")').first.click()
            page.wait_for_timeout(800)
            back_home = page.locator("text=How can I help?").count() > 0
            results.append(("new_chat_returns_home", back_home))
        except Exception as e:
            results.append(("new_chat_returns_home", False))

        browser.close()

    for name, ok in results:
        print(("PASS" if ok else "FAIL"), name)
    if all(ok for _, ok in results):
        print("HOMEPAGE-LOAD-AUDIT: ALL-PASS")
        sys.exit(0)
    print("HOMEPAGE-LOAD-AUDIT: FAILURES")
    sys.exit(1)


if __name__ == "__main__":
    main()

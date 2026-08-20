"""Print ancestor chain widths for the chat column at 375px viewport."""
import json
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:5173"
SEED = """
(() => {
  const chatId = "audit-table-chat";
  const chat = {
    id: chatId, title: "Table audit", modelKey: "nvidia/z-ai/glm-5.2",
    createdAt: Date.now(), updatedAt: Date.now(),
    messages: [
      { id: "m1", role: "user", content: "wide table please", createdAt: Date.now() },
      { id: "m2", role: "assistant", content: "| H1 | H2 | H3 |\\n|---|---|---|\\n| A | B | C |", done: true, createdAt: Date.now() },
    ],
  };
  localStorage.setItem("asky.chats", JSON.stringify([chat]));
  localStorage.setItem("asky.activeChatId", chatId);
})();
"""


def main():
    with sync_playwright() as pw:
        b = pw.chromium.launch(headless=True, args=["--disable-gpu"])
        c = b.new_context(viewport={"width": 375, "height": 812})
        p = c.new_page()
        p.add_init_script(SEED)
        p.goto(BASE, wait_until="domcontentloaded", timeout=30000)
        p.wait_for_timeout(2500)
        info = p.evaluate("""() => ({
            iw: innerWidth,
            htmlW: document.documentElement.getBoundingClientRect().width,
            bodyW: document.body.getBoundingClientRect().width,
            rootW: document.getElementById('root').getBoundingClientRect().width,
            chains: (function(){
                const body = document.querySelector('.msg-body');
                if (!body) return [];
                const out = [];
                let node = body;
                while (node && node.tagName) {
                    const cs = getComputedStyle(node);
                    out.push({tag: node.tagName, cls: String(node.className||'').slice(0,50),
                        bw: node.getBoundingClientRect().width, cw: cs.width,
                        ml: cs.marginLeft, mr: cs.marginRight, pl: cs.paddingLeft, pr: cs.paddingRight,
                        ofx: cs.overflowX});
                    node = node.parentElement;
                }
                return out;
            })(),
        })""")
        print(json.dumps(info, indent=1))


if __name__ == "__main__":
    main()

"""Run the EXACT audit seed and dump computed widths to find why wrap overflows."""
import sys

sys.path.insert(0, "tests")
from table_mobile_audit import SEED_JS  # noqa: E402

from playwright.sync_api import sync_playwright


def main():
    with sync_playwright() as pw:
        b = pw.chromium.launch(headless=True, args=["--disable-gpu"])
        c = b.new_context(viewport={"width": 375, "height": 812})
        p = c.new_page()
        p.goto("http://127.0.0.1:5173/", wait_until="domcontentloaded", timeout=30000)
        p.wait_for_timeout(1500)
        p.evaluate(SEED_JS)
        p.reload(wait_until="domcontentloaded", timeout=30000)
        p.wait_for_timeout(2500)
        print(p.evaluate("""() => {
          const wrap = document.querySelector('.msg-body .table-wrap');
          const table = document.querySelector('.msg-body table');
          const msgBody = document.querySelector('.msg-body');
          const td = table ? table.querySelector('td') : null;
          const cs = (e) => { if (!e) return null; const s = getComputedStyle(e);
            return { w: e.getBoundingClientRect().width, cw: s.width, ofx: s.overflowX,
                     wb: s.wordBreak, ws: s.whiteSpace, mb: s.maxWidth, dsp: s.display }; };
          return { iw: innerWidth, msgBody: cs(msgBody), wrap: cs(wrap), table: cs(table), td: cs(td) };
        }"""))


if __name__ == "__main__":
    main()

// Playwright mobile audit: verify a wide markdown table does not overflow the chat column.
import { chromium } from "playwright";

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 375, height: 812 },
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});
const page = await ctx.newPage();

// Seed localStorage so a chat with a WIDE markdown table exists on load.
const seed = `
(() => {
  const chatId = "audit-table-chat";
  const chat = {
    id: chatId,
    title: "Table audit",
    modelKey: "nvidia/z-ai/glm-5.2",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [
      { id: "m1", role: "user", content: "wide table please", createdAt: Date.now() },
      {
        id: "m2",
        role: "assistant",
        content: "| Long Header Column That Should Not Overflow | Second Very Long Header | Third Wide Header |\\n|---|---|---|\\n| Some very long first cell content that is deliberately wide to test horizontal scrolling on mobile viewports | Second long cell value with plenty of text | Third cell data that is also wide |\\n| Short | Medium length cell | Final wide cell with extra content to push table width |",
        done: true,
        createdAt: Date.now(),
      },
    ],
  };
  const all = { [chatId]: chat };
  localStorage.setItem("asky.chats", JSON.stringify(all));
  localStorage.setItem("asky.activeChatId", chatId);
  localStorage.setItem("asky.settings", JSON.stringify({ dark: true }));
})();
`;
await page.addInitScript(seed);
await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.waitForSelector(".msg-body", { timeout: 10000 });

// Evaluate the table geometry.
const report = await page.evaluate(() => {
  const wrap = document.querySelector(".msg-body .table-wrap");
  const table = document.querySelector(".msg-body table");
  const col = document.querySelector("[data-chat-col], .chat-col, main, section");
  const msgBody = document.querySelector(".msg-body");
  const colW = col ? col.getBoundingClientRect().width : null;
  const msgW = msgBody ? msgBody.getBoundingClientRect().width : null;
  return {
    wrapExists: !!wrap,
    colW,
    msgW,
    wrapW: wrap ? wrap.getBoundingClientRect().width : null,
    wrapScrollW: wrap ? wrap.scrollWidth : null,
    tableW: table ? table.getBoundingClientRect().width : null,
    wrapOverflowX: wrap ? getComputedStyle(wrap).overflowX : null,
  };
});
console.log("TABLE-AUDIT:", JSON.stringify(report));

// Assertions
let failed = 0;
if (!report.wrapExists) { console.log("FAIL: .table-wrap missing"); failed++; }
if (report.tableW != null && report.colW != null && report.tableW > report.colW + 2) {
  // Table may be wider than the column, BUT the wrap must clip it (scroll container).
  if (!(report.wrapW != null && report.wrapW <= report.colW + 2)) {
    console.log("FAIL: wrap wider than chat column"); failed++;
  }
}
if (report.wrapOverflowX !== "auto" && report.wrapOverflowX !== "scroll") {
  console.log("FAIL: wrap overflow-x not scrollable:", report.wrapOverflowX); failed++;
}
if (failed === 0) console.log("ALL-TABLE-CHECKS-PASS");
else console.log("FAILED:", failed);

await browser.close();

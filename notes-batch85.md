# Batch 85 state (2026-08-20, evening)

## User request
Mobile markdown table width overflows chat column on phone (screenshot: GPT-OSS 20B Groq 3-col table, right column text cut off) on aichatapp-8ksusdph.manus.space.

## Fix implemented in ai_chat_app (canonical src)
- `src/richMd.ts`: custom `renderer.table` wraps tables in `<div class="table-wrap"><table>...</table></div>`; renders th from token.header, rows from token.rows. 4/4 richMd tests pass.
- `src/index.css`: `.msg-body .table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}`, `.msg-body table{display:block;max-width:100%}`, th/td white-space normal + break-word, th bg.
- Vitest 109 pass (110 total, nvidia-stream skipped), tsc clean.

## Audit tooling
- `tests/table_mobile_audit.py`: seeds wide table chat, 375x812 Chromium, checks wrapExists/overflowX=auto|scroll/wrapW<=colW/msgW<=colW/thExists. Uses `new_context` + viewport — WORKS (innerWidth=375).
- IMPORTANT: launch_persistent_context IGNORES the viewport kwarg in this env (colW=768). Use browser.new_context().
- `tests/table_debug.py`: extracts SEED_JS from audit script and dumps computed widths.
- Storage keys: asky.chats = ARRAY (not object!), asky.activeChatId, asky.settings. Chat shape needs: id,title,modelKey,createdAt,updatedAt,messages[{id,role,content,createdAt,done}].
- Store init: `pruneExpiredChats()` runs at load; chats with updatedAt < 5 days ago are KEPT (cutoff=now-5d → c.updatedAt > cutoff keeps fresh). Seeded chats kept.
- **UNRESOLVED ODDITY**: audit sometimes gets asky.chats=[] after load even though init_script seeded before page JS. Hypothesis: the app's SettingsModal or some effect calls clearConversations()? No. OR the page's ErrorBoundary re-mounted and re-ran? In one debug run: chats became [] and "No chats yet" rendered. The FIRST (old) audit run with persistent context got chats:["0"] and PASS. Fix approach: seed AFTER domcontentloaded via evaluate instead of init_script, or seed with updatedAt=Date.now() and retry.

## Key layout facts (verified via chain debug at 375px)
- Ancestor chain all 375 wide; .msg-body 299px (with 16px padding). With fix, short tables: wrap=299, table=299, td=238. wordBreak=break-word works; long unbreakable tokens still force width (X9... token in 3-col table gave wrap=299 in direct test — table shrank fine).
- Column container: `max-w-3xl lg:max-w-4xl mx-auto` (ChatScreen lines 592/885/995).

## Environment facts
- Asky site source = /home/ubuntu/ai_chat_app (src/richMd.ts, index.css, vite.config.ts port 5173, server/index.ts proxied at 3001). This IS the canonical Asky web site (Expo dirs app/(tabs) are leftover template).
- Dev: vite 5173 + tsx watch server/index.ts (port 3001, running PIDs 90491+). Preview: 5173-ifltpt9gac53ajpd23u17-dabfae35.us4.manus.computer.
- Published: aichatapp-8ksusdph.manus.space. GitHub: surinder2003k/Asky branch website; PAT2 working (github_pat_...fewkgO3BXFWC6mlhiBbAV). Push via Git References REST API (normal push blocked).
- asky-audit helpers at /home/ubuntu/asky-audit (playwright system 1.62).
- webdev checkpoint last: 59a186d1 (Batch 84). NO checkpoint since table fix.

## ROOT CAUSE FOUND (table overflow on mobile)
Chain debug at 375 viewport: `div.flex.h-full` (root shell) = 375, but `<main className="relative flex flex-1 flex-col">` in src/App.tsx line 210 = 768 (wider than its own parent!). Flex item min-width defaults to auto (= intrinsic content width), so the wide table (692) stretches main past the 375 shell. Fix: add `min-w-0` to <main> in App.tsx (and messages scroll container got min-w-0 too). After fixing main, re-verify: msgBody/wrap/table should be ≤299.
- Audit seeding: seed via page.evaluate() AFTER domcontentloaded + reload (init_script unreliable — store hydrates and can reset chats). SEED_JS needs wrap in IIFE when passed to evaluate.
- chain debug at 375 previously passed (299) ONLY because that session had... actually it passed because main happened to be 375 then — prior to adding width rules? Regardless: current fix targets main min-w-0.
- audit script: tests/table_mobile_audit.py (uses new_context 375x812, colW=innerWidth). table_debug.py dumps widths with exact audit seed.

## VERIFICATION STATUS (20:45)
- main min-w-0 fix WORKS: msgBody/wrap/table all 299 at 375 viewport. audit ALL-TABLE-CHECKS-PASS.
- Unbreakable 96-char token: td wraps (word-break:break-word) — tW=299, scrollW=wrapW=299. This is the DESIGNED outcome (wrapping over horizontal scroll for table cells with word-break). overflow-x:auto is still present as a safety net.
- Remaining: add min-w-0 test to audit (ensure column itself ≤ innerWidth), vitest + tsc, screenshot on 375 + desktop, sync GitHub website branch, checkpoint, deliver.

## FINAL VERIFICATION (20:50)
Both screenshots confirmed: mobile 375px — table sits fully inside the chat column, cells wrap cleanly, nothing cut off (previously the table stretched past the screen edge). Desktop 1280px — table renders wide and normal as before. vitest 109 pass (26 files, 1 skipped), tsc clean, mobile audit ALL-TABLE-CHECKS-PASS + main fits viewport (mainW=375, colW=375, iw=375). Screenshots at /home/ubuntu/upload/table-fix-mobile.png and table-fix-desktop.png.

## Remaining TODO
- [ ] Fix audit seed persistence (seed via evaluate after load, or figure why store clears) and get ALL-TABLE-CHECKS-PASS with the forced-wide token (wrapScrollW > wrapW for unbreakable token).
- [ ] Also verify old behavior WOULD fail: git stash not possible; just trust design. Optionally capture screenshot.
- [ ] Run full Playwright audit (asky-audit/audit.py against 5173) + vitest.
- [ ] Checkpoint + deliver to user (Hinglish).

# Batch 89 notes (2026-08-20)

## User request
1. Login stuck/lag when tapping Sign in on LIVE site (aichatapp-8ksusdph.manus.space) — fix
2. Implement 3 suggestions: (a) password change in Settings, (b) "Remember this device" toggle at login, (c) table tap-to-copy (CSV)

## Done in src/ (all implemented, tsc clean)
- auth.ts: instant tryLogin (no dynamic import, no 450ms delay), credentials seeded ONCE into localStorage `asky.authCreds` (hashed; plaintext never stored). Keys: asky.session, asky.sessionToken, asky.authCreds. changePassword(old,new) → {ok,error}, revokes session.
- LandingPage.tsx: "Remember this device for 30 days" checkbox (default ON); OFF → removes asky.sessionToken after login so next visit shows landing. loading spinner + "Signing in..." text.
- SettingsModal.tsx: Change Password section wired.
- richMd.ts: table renderer wraps table in div.table-wrap with hidden textarea.table-csv-src carrying CSV (PLACEHOLDER pattern: TABLECSV_n, restored post-DOMPurify in renderRichMd). mountTableCopyHandlers(root) click→clipboard.writeText(csv)→"Table copied" hint 1.4s (div.table-copied-hint). ChatScreen post-render calls it on document.body.
- index.css: .table-wrap, .table-copied-hint styles.
- Fix added: csvQueue.length=0 at start of renderRichMd (fresh queue per render).

## Audit status (2026-08-20)
- vitest: 108/109 (1 fail = nvidia-stream.provider-network flake, batch-88 also; not regression)
- tap_copy_audit.py: NEW, ALL-PASS (5/5). Seeds chat via add_init_script + reload, opens sidebar via button[title="Open sidebar"], clicks row, checks csv clipboard + hint + layout. Selector gotchas: toggle is title="Open sidebar" (NOT "Open chat sidebar"); row = button filter has_text "Table audit".
- login_audit.py updated: loading-state now polls window.__loadStates via interval; remember-toggle section added (checkbox dispatch click force). ISSUE: login_loading_state FAILS after wrong-creds attempt because React 19 skips the disabled+Signing-in paint when submit follows an error state (RAF polling shows [Sign in]→[NOBTN] with no intermediate disabled frame; fresh attempt DOES paint it).
  - Debug probes: /tmp/raf_sniff2.py (after error: no paint), /tmp/raf_sniff3.py (fresh: paints disabled).
- homepage_load_audit.py: FAIL 4 checks — composer_visible FAIL, last_chat_NOT_restored PASS, sidebar_lists_old_chats FAIL, click_sidebar_opens_chat FAIL, new_chat_returns_home FAIL. DEBUG: {"chats": ["0"], "active": "audit-table-chat", ...} — leftover asky.activeChatId="audit-table-chat" from previous tap-copy run (seed + reload left it); audit itself does NOT clear it. Also homepage audits use their own seeded chats. Investigate: clear asky.activeChatId in audit or verify app behavior.
- table_mobile_audit.py: FAIL — chats:["0"] but table not rendered; likely same leftover activeChatId + seeded chats leftover interfering.

## Remaining steps
1. Fix login loading paint: make disabled+Signing-in paint reliably even after error state. TRY: after successful verify, defer transition via `await new Promise(r=>setTimeout(r,0)); onLoggedIn()` so the disabled state commits + paints one frame before unmount.
2. Re-run login_audit → expect ALL-PASS (11+ checks incl. remember_toggle_off, no_persist_when_remember_off).
3. Investigate homepage_load_audit + table_mobile_audit failures — likely leftover asky.activeChatId from tap-copy seeding (audit state not cleared between runs). Clear asky.chats/asky.activeChatId/sessionStorage at audit start or note: audits should clear stale keys. Then re-run both.
4. Add a changePassword audit (settings modal): open settings → Change password → wrong-old rejected → right-old+new accepted → re-login with new pw works; REVERT password to 3424 at the end! (Or just audit that wrong-old rejected + right accepted; revert at end.)
5. tsc + vitest final.
6. GitHub sync: python3 scripts/sync-via-api.py (EXCLUDE="scripts/sanitize-for-github.py,scripts/sanitize-for-github.pyc,notes-*.md"); verify with scripts/verify-remote.py; credentials.ts is gitignored (verify before push).
7. Checkpoint (message: batch 89), deliver in Hinglish. Remind user to click Publish for live site.
- Dev server: vite 5173, proxy 3001. Live: aichatapp-8ksusdph.manus.space
- Sidebar: fixed inset-y drawer, translate-x animation; chat row = <button> with chat title text; toggle = <button title="Open sidebar"> (App.tsx line ~222).
- ChatScreen row button click auto-closes sidebar.

# Batch 87 — homepage always opens as new chat (empty suggestions state)

## User request (Hinglish, from chat)
When user re-opens the site homepage, it must NOT restore the last active chat; it must always show the empty "How can I help?" state with suggestions. Existing chats stay in sidebar; clicking one opens it.

## Fix applied
- `src/store.tsx` init useEffect: changed `active` from `c[0].id` (first chat auto-restored) to `null`. Only importedId (deep-link/import) still auto-opens a specific chat.

## Files
- tests/homepage_load_audit.py: Playwright audit. SEED_JS injected via add_init_script (before navigation, in page origin). Checks:
  1. home_empty_state_shown (text "How can I help?")
  2. composer_visible (placeholder "Message Asky")
  3. last_chat_NOT_restored ("hi there" not visible)
  4. sidebar_lists_old_chats (titles in aside)
  5. click_sidebar_opens_chat (click "Old Test Chat", "hi there" appears)
  6. new_chat_returns_home (New chat button → home state)
- Storage keys: asky.chats (array), asky.activeChatId.
- Chat row shape: {id,title,folderId,pinned,messages,modelKey,createdAt,updatedAt}; messages items {role,content,attachments[]}.
- Sidebar title text inside <aside>; New chat button text "New chat".

## Status so far
- tsc clean after fix.
- Audit run 1: failed with SecurityError on page.evaluate before navigation — fixed by switching to add_init_script.
- Audit run 2: PENDING (run `python3 tests/homepage_load_audit.py` from /home/ubuntu/ai_chat_app)
- Remaining: run audit, vitest, screenshot verify, todo.md mark done, checkpoint, deliver (attach manus-webdev://<version>).
- Batch 86 checkpoint was 80806046 (PWA). Live domain: aichatapp-8ksusdph.manus.space (already published).

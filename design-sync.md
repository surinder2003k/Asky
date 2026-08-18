# Cloud Chat Sync Design (No Login)

## Constraint
User wants no login/auth. But cloud sync needs a way to identify "whose chats these are".
Solution: **anonymous device session** — app generates a random `sessionId` (16 chars), stores it
locally (AsyncStorage). All cloud operations are scoped to that sessionId.

## Data model (MySQL/Drizzle)

### chat_sessions
- id: int autoincrement PK
- sessionId: varchar(64) unique NOT NULL
- appVersion: varchar(32) NULL (app checkpoint version)
- createdAt: timestamp
- lastSeenAt: timestamp (updated on every sync call)

### conversations_cloud
- id: int autoincrement PK
- sessionId: varchar(64) NOT NULL
- convId: varchar(32) NOT NULL (client-side conv id, unique per session)
- title: varchar(255)
- modelKey: varchar(128)
- messagesJson: text (JSON array of messages)
- updatedAt: timestamp
- UNIQUE(sessionId, convId)

### sync_markers
- id: int autoincrement PK
- sessionId: varchar(64) NOT NULL
- lastSyncedAt: bigint (ms epoch)
- lastPushedAt: bigint

## Sync protocol (last-write-wins, client timestamp)
1. On mount: client pushes all locally-modified conversations since lastPushedAt
   → server upserts by (sessionId, convId) with `updatedAt` check (server only
   updates when incoming updatedAt > existing updatedAt)
2. Client pulls conversations where server updatedAt > client updatedAt
   → merge into AsyncStorage
3. Delete: client includes `deletedIds` list; server deletes those rows
   → client deletes locally
4. Images stay local-only (too big); chat text + metadata sync only

## API (publicProcedure, session-scoped)
- chats.sync: input { sessionId, push: [{convId, title, modelKey, messages, updatedAt}],
  pulledSince: number, deletedIds: string[] }
  returns { ok: true, pulled: [{convId, title, modelKey, messages, updatedAt}],
  deletedIds: string[] }

## Storage decision
- User setting "Cloud sync" toggle in Settings (on/off). OFF = local-only (existing behavior).
- API keys NEVER sync (local only, per user policy).
- Auto-expire rows older than 90 days via cleanup on sync.

## UI features (free)
1. Copy whole message — copy icon per assistant bubble (expo-clipboard)
2. Regenerate — regenerate icon on assistant bubbles (only while streaming finished;
   re-sends last user message with current model)
3. Rename chat — edit title in history sheet
4. Dark mode toggle — Settings + theme context (ThemeContext already exists in lib/theme-provider)
5. Typing indicator — animated 3-dot bubble while AI is streaming first token hasn't arrived
6. Long-press message menu — pressable with LongPressGesture? simpler: press-and-hold
   via onPressIn timer → context menu sheet with Copy / Regenerate / Delete
7. Auto-scroll button — floating arrow-down button when scrolled up
8. Cloud sync toggle + status in Settings

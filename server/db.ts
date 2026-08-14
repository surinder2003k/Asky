import { and, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { chatSessions, conversationsCloud, InsertUser, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ------------------------------------------------------------------
// Anonymous cloud chat sync (sessionId-scoped, no login required)
// ------------------------------------------------------------------

export type SyncPushItem = {
  convId: string;
  title?: string | null;
  modelKey?: string | null;
  messagesJson?: string | null;
  updatedAt: string; // epoch ms as decimal string
};

export type SyncPullItem = {
  convId: string;
  title: string | null;
  modelKey: string | null;
  messagesJson: string | null;
  updatedAt: string;
};

export async function ensureSession(sessionId: string, appVersion?: string) {
  const db = await getDb();
  if (!db) return;
  try {
    await db
      .insert(chatSessions)
      .values({ sessionId, appVersion: appVersion ?? null })
      .onDuplicateKeyUpdate({
        set: {
          lastSeenAt: new Date(),
          appVersion: appVersion ?? sql`appVersion`,
        },
      });
  } catch (error) {
    console.error("[Database] ensureSession failed:", error);
  }
}

/**
 * Push local changes and pull remote changes in one round-trip.
 * Upsert only wins when incoming updatedAt is strictly greater (per convId).
 * Rows untouched for 90+ days are cleaned up to keep the table small.
 */
export async function syncChats(
  sessionId: string,
  push: SyncPushItem[],
  deletedIds: string[],
): Promise<SyncPullItem[]> {
  const db = await getDb();
  if (!db) return [];

  // 1. Upsert pushed items — only update when incoming is newer
  for (const item of push) {
    const existing = await db
      .select()
      .from(conversationsCloud)
      .where(
        and(
          eq(conversationsCloud.sessionId, sessionId),
          eq(conversationsCloud.convId, item.convId),
        ),
      )
      .limit(1);

    const incomingTs = parseInt(item.updatedAt, 10);
    const existingTs = existing.length > 0 ? parseInt(existing[0].updatedAt, 10) : -1;

    if (existing.length === 0) {
      await db.insert(conversationsCloud).values({
        sessionId,
        convId: item.convId,
        title: item.title ?? null,
        modelKey: item.modelKey ?? null,
        messagesJson: item.messagesJson ?? null,
        updatedAt: item.updatedAt,
      });
    } else if (incomingTs > existingTs) {
      await db
        .update(conversationsCloud)
        .set({
          title: item.title ?? null,
          modelKey: item.modelKey ?? null,
          messagesJson: item.messagesJson ?? null,
          updatedAt: item.updatedAt,
        })
        .where(
          and(
            eq(conversationsCloud.sessionId, sessionId),
            eq(conversationsCloud.convId, item.convId),
          ),
        );
    }
  }

  // 2. Delete conversation ids marked as removed locally
  if (deletedIds.length > 0) {
    await db
      .delete(conversationsCloud)
      .where(
        and(
          eq(conversationsCloud.sessionId, sessionId),
          inArray(conversationsCloud.convId, deletedIds),
        ),
      );
  }

  // 3. Pull every row for this session (client merges by updatedAt)
  const rows = await db
    .select()
    .from(conversationsCloud)
    .where(eq(conversationsCloud.sessionId, sessionId));

  // 4. Periodic cleanup: remove rows untouched for 90+ days
  try {
    await db
      .delete(conversationsCloud)
      .where(
        and(
          eq(conversationsCloud.sessionId, sessionId),
          sql`lastModifiedAt < DATE_SUB(NOW(), INTERVAL 90 DAY)`,
        ),
      );
  } catch {
    /* table may lack the column; cleanup is best-effort */
  }

  return rows.map((r) => ({
    convId: r.convId,
    title: r.title,
    modelKey: r.modelKey,
    messagesJson: r.messagesJson,
    updatedAt: r.updatedAt,
  }));
}

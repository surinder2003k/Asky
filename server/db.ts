import { and, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { conversations, folders, InsertUser, users, userSettings } from "../drizzle/schema";
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
  if (!user.clerkId) {
    throw new Error("User clerkId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      clerkId: user.clerkId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email"] as const;
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
    } else if (user.clerkId === ENV.ownerOpenId) {
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

export async function getUserByClerkId(clerkId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ------------------------------------------------------------------
// User-scoped cloud chat sync (Clerk-authenticated)
// ------------------------------------------------------------------

export async function getUserSettings(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  return result.length > 0 ? JSON.parse(result[0].settingsJson) : null;
}

export async function saveUserSettings(userId: number, settings: any) {
  const db = await getDb();
  if (!db) return;
  await db.insert(userSettings).values({
    userId,
    settingsJson: JSON.stringify(settings),
  }).onDuplicateKeyUpdate({
    set: { settingsJson: JSON.stringify(settings) },
  });
}

export async function getUserChats(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(conversations).where(eq(conversations.userId, userId));
}

export async function saveChat(userId: number, chat: any) {
  const db = await getDb();
  if (!db) return;
  await db.insert(conversations).values({
    userId,
    convId: chat.id,
    folderId: chat.folderId || null,
    title: chat.title || null,
    modelKey: chat.modelKey || null,
    systemPrompt: chat.systemPrompt || null,
    pinned: chat.pinned ? 1 : 0,
    messagesJson: JSON.stringify(chat.messages),
    updatedAt: new Date(chat.updatedAt || Date.now()),
  }).onDuplicateKeyUpdate({
    set: {
      folderId: chat.folderId || null,
      title: chat.title || null,
      modelKey: chat.modelKey || null,
      systemPrompt: chat.systemPrompt || null,
      pinned: chat.pinned ? 1 : 0,
      messagesJson: JSON.stringify(chat.messages),
      updatedAt: new Date(chat.updatedAt || Date.now()),
    },
  });
}

export async function deleteChatById(userId: number, convId: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(conversations).where(and(eq(conversations.userId, userId), eq(conversations.convId, convId)));
}

export async function getUserFolders(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(folders).where(eq(folders.userId, userId));
}

export async function saveFolder(userId: number, folder: any) {
  const db = await getDb();
  if (!db) return;
  await db.insert(folders).values({
    userId,
    folderId: folder.id,
    name: folder.name,
    color: folder.color || null,
    order: folder.order || 0,
  }).onDuplicateKeyUpdate({
    set: {
      name: folder.name,
      color: folder.color || null,
      order: folder.order || 0,
    },
  });
}

export async function deleteFolderById(userId: number, folderId: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(folders).where(and(eq(folders.userId, userId), eq(folders.folderId, folderId)));
}

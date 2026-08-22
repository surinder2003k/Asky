import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import * as db from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";

const HOSTED_CONFIG_URL =
  process.env.REMOTE_CONFIG_URL ||
  "https://files.manuscdn.com/user_upload_by_module/session_file/310519663665550846/qbGCDyrxOHviqHRq.json";

let cachedConfig: unknown = null;
let cacheExpiry = 0;

async function getHostedConfig(): Promise<unknown> {
  const now = Date.now();
  if (cachedConfig && now < cacheExpiry) return cachedConfig;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(HOSTED_CONFIG_URL, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    cachedConfig = data;
    cacheExpiry = now + 60_000; // refetch every 60s
    return data;
  } catch {
    return cachedConfig ?? null;
  }
}

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  remoteConfig: router({
    get: publicProcedure.query(async () => {
      return (await getHostedConfig()) ?? null;
    }),
  }),
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // User-scoped cloud chat sync (Clerk-authenticated)
  chats: router({
    getAll: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return [];
      const rows = await db.getUserChats(ctx.user.id);
      return rows.map(r => ({
        id: r.convId,
        folderId: r.folderId,
        title: r.title,
        modelKey: r.modelKey,
        systemPrompt: r.systemPrompt,
        pinned: !!r.pinned,
        messages: JSON.parse(r.messagesJson),
        updatedAt: r.updatedAt.getTime(),
      }));
    }),
    save: publicProcedure
      .input(z.object({
        id: z.string(),
        folderId: z.string().nullable().optional(),
        title: z.string().nullable().optional(),
        modelKey: z.string().nullable().optional(),
        systemPrompt: z.string().nullable().optional(),
        pinned: z.boolean().optional(),
        messages: z.array(z.any()),
        updatedAt: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new Error("Unauthorized");
        await db.saveChat(ctx.user.id, input);
        return { ok: true };
      }),
    delete: publicProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new Error("Unauthorized");
        await db.deleteChatById(ctx.user.id, input.id);
        return { ok: true };
      }),
    getFolders: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return [];
      const rows = await db.getUserFolders(ctx.user.id);
      return rows.map(r => ({
        id: r.folderId,
        name: r.name,
        color: r.color,
        order: r.order,
      }));
    }),
    saveFolder: publicProcedure
      .input(z.object({
        id: z.string(),
        name: z.string(),
        color: z.string().nullable().optional(),
        order: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new Error("Unauthorized");
        await db.saveFolder(ctx.user.id, input);
        return { ok: true };
      }),
    deleteFolder: publicProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new Error("Unauthorized");
        await db.deleteFolderById(ctx.user.id, input.id);
        return { ok: true };
      }),
    sync: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return null;
      const [chats, folders, settings] = await Promise.all([
        db.getUserChats(ctx.user.id),
        db.getUserFolders(ctx.user.id),
        db.getUserSettings(ctx.user.id),
      ]);
      return {
        chats: chats.map(r => ({
          id: r.convId,
          folderId: r.folderId,
          title: r.title,
          modelKey: r.modelKey,
          systemPrompt: r.systemPrompt,
          pinned: !!r.pinned,
          messages: JSON.parse(r.messagesJson),
          updatedAt: r.updatedAt.getTime(),
        })),
        folders: folders.map(r => ({
          id: r.folderId,
          name: r.name,
          color: r.color,
          order: r.order,
        })),
        settings: settings || {
          apiKeys: {},
          theme: "dark",
          accent: "teal",
          voiceLang: "en",
          pinEnabled: false,
          favoriteModelKeys: [],
          lastUsedModelKeys: [],
          nicknames: {},
          customModels: [],
          templates: [],
          ttsEnabled: false,
          ttsRate: 1,
          ttsLang: "en",
          chatWidth: "medium",
          fontSize: "medium",
          temperature: 0.7,
          topP: 1,
          voiceInputEnabled: true,
        },
      };
    }),
    getSettings: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return null;
      return await db.getUserSettings(ctx.user.id);
    }),
    update: publicProcedure
      .input(z.any())
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new Error("Unauthorized");
        await db.saveUserSettings(ctx.user.id, input);
        return { ok: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;

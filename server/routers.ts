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

  // Anonymous cloud chat sync (session-scoped, no login required)
  chats: router({
    sync: publicProcedure
      .input(
        z.object({
          sessionId: z.string().min(8).max(64),
          appVersion: z.string().max(32).optional(),
          push: z
            .array(
              z.object({
                convId: z.string().min(1).max(32),
                title: z.string().max(255).nullable().optional(),
                modelKey: z.string().max(128).nullable().optional(),
                messagesJson: z.string().max(5_000_000).nullable().optional(),
                updatedAt: z.string().min(1).max(20),
              }),
            )
            .default([]),
          deletedIds: z.array(z.string().min(1).max(32)).default([]),
        }),
      )
      .mutation(async ({ input }) => {
        await db.ensureSession(input.sessionId, input.appVersion);
        const pulled = await db.syncChats(
          input.sessionId,
          input.push,
          input.deletedIds,
        );
        return { ok: true, pulled } as const;
      }),
  }),
});

export type AppRouter = typeof appRouter;

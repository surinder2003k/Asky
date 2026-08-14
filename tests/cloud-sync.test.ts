import { describe, expect, it } from "vitest";

// Verify the input validation shape of the sync endpoint.
import { appRouter } from "../server/routers";

const createCaller = () =>
  appRouter.createCaller({
    user: null,
    req: {} as never,
    res: {} as never,
  } as never);

const caller = createCaller();

describe("chats.sync endpoint", () => {
  it("rejects a too-short sessionId", async () => {
    await expect(
      caller.chats.sync({
        sessionId: "ab",
        push: [],
        deletedIds: [],
      }),
    ).rejects.toThrow();
  });

  it("accepts a valid push and returns pulled rows", async () => {
    const result = await caller.chats.sync({
      sessionId: "unittestsession01",
      push: [
        {
          convId: "ut1",
          title: "Unit test chat",
          modelKey: "x",
          messagesJson: JSON.stringify([
            { role: "user", text: "hi", createdAt: Date.now() },
          ]),
          updatedAt: String(Date.now()),
        },
      ],
      deletedIds: [],
    });
    expect(result.ok).toBe(true);
    const found = result.pulled.find((r: { convId: string }) => r.convId === "ut1");
    expect(found?.title).toBe("Unit test chat");
  });

  it("propagates deletes", async () => {
    await caller.chats.sync({
      sessionId: "unittestsession02",
      push: [{ convId: "ut2", title: "t", modelKey: "x", messagesJson: "[]", updatedAt: String(Date.now()) }],
      deletedIds: [],
    });
    await caller.chats.sync({
      sessionId: "unittestsession02",
      push: [],
      deletedIds: ["ut2"],
    });
    const result = await caller.chats.sync({
      sessionId: "unittestsession02",
      push: [],
      deletedIds: [],
    });
    expect(result.pulled.find((r: { convId: string }) => r.convId === "ut2")).toBeUndefined();
  });
});

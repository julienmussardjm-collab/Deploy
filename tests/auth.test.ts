import { describe, it, expect, vi } from "vitest";

const mockUser = {
  id: 1,
  openId: "oauth-123",
  name: "Test User",
  email: "test@example.com",
  role: "user" as const,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  lastSignedIn: new Date("2024-01-15"),
};

vi.mock("../src/server/db/index.js", () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      meetings: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
  },
  schema: {},
}));

import { authRouter } from "../src/server/routers/auth.js";
import type { Context } from "../src/server/trpc.js";

function createCaller(userId?: number) {
  const ctx: Context = {
    req: {} as never,
    res: {} as never,
    userId,
  };
  return authRouter.createCaller(ctx);
}

describe("Auth Router", () => {
  describe("auth.me", () => {
    it("should return null when user is not authenticated", async () => {
      const caller = createCaller(); // no userId
      const result = await caller.me();
      expect(result).toBeNull();
    });

    it("should return user data when authenticated", async () => {
      const { db } = await import("../src/server/db/index.js");
      (db.query.users.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockUser
      );

      const caller = createCaller(1); // with userId
      const result = await caller.me();

      expect(result).toBeDefined();
      expect(result?.id).toBe(1);
      expect(result?.name).toBe("Test User");
      expect(result?.email).toBe("test@example.com");
    });

    it("should return null when userId exists but user not found in DB", async () => {
      const { db } = await import("../src/server/db/index.js");
      (db.query.users.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        null
      );

      const caller = createCaller(999); // non-existent user
      const result = await caller.me();

      expect(result).toBeNull();
    });
  });

  describe("auth.logout", () => {
    it("should return success when logging out", async () => {
      const caller = createCaller(1);
      const result = await caller.logout();

      expect(result).toEqual({ success: true });
    });

    it("should return success even when not logged in", async () => {
      const caller = createCaller(); // anonymous
      const result = await caller.logout();

      expect(result).toEqual({ success: true });
    });
  });

  describe("auth.getLoginUrl", () => {
    it("should return null when VITE_APP_ID is not set", async () => {
      const originalAppId = process.env.VITE_APP_ID;
      delete process.env.VITE_APP_ID;

      const caller = createCaller();
      const result = await caller.getLoginUrl();

      expect(result).toBeNull();

      if (originalAppId) process.env.VITE_APP_ID = originalAppId;
    });

    it("should return login URL when VITE_APP_ID is set", async () => {
      process.env.VITE_APP_ID = "test-app-id";

      const caller = createCaller();
      const result = await caller.getLoginUrl();

      expect(result).toBeDefined();
      expect(result?.loginUrl).toContain("test-app-id");
      expect(result?.loginUrl).toContain("oauth/authorize");

      delete process.env.VITE_APP_ID;
    });
  });
});

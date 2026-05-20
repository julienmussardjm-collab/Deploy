import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import * as jose from "jose";
import * as dotenv from "dotenv";

dotenv.config();

const JWT_SECRET =
  process.env.JWT_SECRET || "development-secret-key-change-in-production";
const OAUTH_SERVER_URL =
  process.env.OAUTH_SERVER_URL || "https://api.manus.im";

export const authRouter = router({
  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.userId) return null;

    const user = await db.query.users.findFirst({
      where: eq(users.id, ctx.userId),
    });

    return user ?? null;
  }),

  logout: publicProcedure.mutation(async () => {
    return { success: true };
  }),

  callback: publicProcedure
    .input(z.object({ code: z.string(), state: z.string().optional() }))
    .mutation(async ({ input }) => {
      try {
        const tokenResponse = await fetch(`${OAUTH_SERVER_URL}/oauth/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: input.code,
            app_id: process.env.VITE_APP_ID,
          }),
        });

        if (!tokenResponse.ok) {
          throw new Error("Failed to exchange OAuth code for token");
        }

        const tokenData = (await tokenResponse.json()) as {
          access_token: string;
          user: { id: string; name: string; email: string };
        };

        const oauthUser = tokenData.user;

        let user = await db.query.users.findFirst({
          where: eq(users.openId, oauthUser.id),
        });

        if (!user) {
          const [newUser] = await db
            .insert(users)
            .values({
              openId: oauthUser.id,
              name: oauthUser.name,
              email: oauthUser.email,
              role: "user",
              lastSignedIn: new Date(),
            })
            .returning();
          user = newUser;
        } else {
          await db
            .update(users)
            .set({ lastSignedIn: new Date(), updatedAt: new Date() })
            .where(eq(users.id, user.id));
        }

        if (!user) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create or find user",
          });
        }

        const secret = new TextEncoder().encode(JWT_SECRET);
        const token = await new jose.SignJWT({ userId: user.id })
          .setProtectedHeader({ alg: "HS256" })
          .setIssuedAt()
          .setExpirationTime("7d")
          .sign(secret);

        return { token, user };
      } catch (error) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: `OAuth callback failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

  getLoginUrl: publicProcedure.query(async () => {
    const appId = process.env.VITE_APP_ID;
    if (!appId) return null;

    const loginUrl = `${OAUTH_SERVER_URL}/oauth/authorize?app_id=${appId}&response_type=code`;
    return { loginUrl };
  }),
});

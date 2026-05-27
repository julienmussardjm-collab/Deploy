import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import * as trpcExpress from "@trpc/server/adapters/express";
import { appRouter } from "./routers/index.js";
import { createContext } from "./trpc.js";
import { ensureDbInit } from "./db/init.js";
import * as dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const NODE_ENV = process.env.NODE_ENV || "development";
const IS_VERCEL = !!process.env.VERCEL;

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin:
        NODE_ENV === "production"
          ? process.env.FRONTEND_URL || true
          : ["http://localhost:5173", "http://localhost:3000"],
      credentials: true,
    })
  );

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  app.use((req: Request, _res: Response, next: NextFunction) => {
    const cookieHeader = req.headers.cookie;
    req.cookies = {};
    if (cookieHeader) {
      cookieHeader.split(";").forEach((cookie: string) => {
        const parts = cookie.split("=");
        const key = parts[0].trim();
        const value = parts.slice(1).join("=").trim();
        if (key) req.cookies[key] = decodeURIComponent(value);
      });
    }
    next();
  });

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Ensure DB tables exist before processing any API request.
  // On first cold-start this waits ~100-300 ms while Turso creates the schema;
  // on warm instances the cached promise resolves immediately.
  app.use("/trpc", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      await ensureDbInit();
      next();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Database init failed";
      console.error("[DB] middleware init error:", err);
      res.status(503).json({ error: message });
    }
  });

  app.use("/api", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      await ensureDbInit();
      next();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Database init failed";
      console.error("[DB] middleware init error:", err);
      res.status(503).json({ error: message });
    }
  });

  app.get("/api/auth/callback", (req: Request, res: Response) => {
    const { code, state } = req.query;
    if (code) {
      res.redirect(`/?code=${code}&state=${state || ""}`);
    } else {
      res.redirect("/?error=oauth_failed");
    }
  });

  app.use(
    "/trpc",
    trpcExpress.createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Serve uploaded audio files
  const uploadsDir = IS_VERCEL
    ? "/tmp/uploads"
    : join(process.cwd(), "uploads");
  app.use("/uploads", express.static(uploadsDir));

  // Serve frontend in production
  if (NODE_ENV === "production" && !IS_VERCEL) {
    const clientDist = join(__dirname, "../../dist/client");
    app.use(express.static(clientDist));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(join(clientDist, "index.html"));
    });
  }

  // Gestionnaire d'erreurs JSON — doit être en dernier, après toutes les routes
  // Garantit que l'API ne renvoie jamais du HTML au client tRPC
  app.use(
    (
      err: unknown,
      _req: Request,
      res: Response,
      _next: NextFunction
    ) => {
      const message =
        err instanceof Error ? err.message : "Internal server error";
      console.error("[Express error handler]", err);
      res.status(500).json({ error: message });
    }
  );

  return app;
}

export type { AppRouter } from "./routers/index.js";

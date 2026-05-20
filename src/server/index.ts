import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import * as trpcExpress from "@trpc/server/adapters/express";
import { appRouter } from "./routers/index.js";
import { createContext } from "./trpc.js";
import * as dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);
const NODE_ENV = process.env.NODE_ENV || "development";

// Middleware
app.use(
  cors({
    origin:
      NODE_ENV === "production"
        ? process.env.FRONTEND_URL || "http://localhost:5173"
        : ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Cookie parser (manual implementation to avoid dependency)
app.use((req, _res, next) => {
  const cookieHeader = req.headers.cookie;
  req.cookies = {};
  if (cookieHeader) {
    cookieHeader.split(";").forEach((cookie) => {
      const parts = cookie.split("=");
      const key = parts[0].trim();
      const value = parts.slice(1).join("=").trim();
      if (key) req.cookies[key] = decodeURIComponent(value);
    });
  }
  next();
});

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// OAuth callback redirect handler (for frontend)
app.get("/api/auth/callback", (req, res) => {
  const { code, state } = req.query;
  if (code) {
    res.redirect(`/?code=${code}&state=${state || ""}`);
  } else {
    res.redirect("/?error=oauth_failed");
  }
});

// tRPC handler
app.use(
  "/trpc",
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// Serve uploaded audio files
const uploadsDir = path.join(__dirname, "../../../uploads");
app.use("/uploads", express.static(uploadsDir));

// Serve static files in production
if (NODE_ENV === "production") {
  const clientDist = path.join(__dirname, "../../dist/client");
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Meeting Recorder server running on port ${PORT}`);
  console.log(`Environment: ${NODE_ENV}`);
  console.log(`tRPC endpoint: http://localhost:${PORT}/trpc`);
  if (NODE_ENV === "development") {
    console.log(`Frontend dev server should run on: http://localhost:5173`);
  }
});

export { app, appRouter };
export type { AppRouter } from "./routers/index.js";

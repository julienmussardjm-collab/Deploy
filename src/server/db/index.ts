import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.js";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config();

const IS_VERCEL = !!process.env.VERCEL;

let _client: Client | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function createDbClient(): Client {
  // .trim() évite les espaces / sauts de ligne copiés-collés depuis un terminal
  const envUrl = process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();

  if (envUrl) {
    // Sur Vercel (serverless), forcer HTTPS au lieu de libsql:// (WebSocket).
    // libsql:// utilise wss:// qui peut bloquer indéfiniment dans les fonctions
    // serverless qui ne maintiennent pas de connexions WebSocket persistantes.
    const url = IS_VERCEL
      ? envUrl.replace(/^libsql:\/\//, "https://")
      : envUrl;
    console.log("[DB] connecting:", url.slice(0, 80));
    try {
      const c = createClient({ url, authToken });
      console.log("[DB] client created OK");
      return c;
    } catch (err) {
      console.error("[DB] createClient failed:", err);
      throw err;
    }
  }

  if (IS_VERCEL) {
    // URL manquante sur Vercel → erreur claire (ne pas utiliser de fichier local)
    throw new Error(
      "TURSO_DATABASE_URL environment variable is required on Vercel. " +
        "Add it in Vercel project settings → Environment Variables."
    );
  }

  // Dev local : chemin absolu obligatoire pour @libsql/client (file:./... invalide)
  const localPath = `file:${resolve("./meeting_recorder.db")}`;
  console.log("[DB] using local SQLite:", localPath);
  return createClient({ url: localPath });
}

/**
 * Retourne le client libsql (lazy init).
 * Lance une erreur si TURSO_DATABASE_URL manque sur Vercel.
 * tRPC attrapera cette erreur et renverra un JSON 500.
 */
export function getClient(): Client {
  if (!_client) {
    _client = createDbClient();
  }
  return _client;
}

function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!_db) {
    _db = drizzle(getClient(), { schema });
  }
  return _db;
}

/**
 * Proxy lazy pour `db` — le module se charge sans erreur même si l'URL est
 * absente. L'erreur survient au premier accès à la DB, là où tRPC peut la
 * capturer et renvoyer du JSON.
 */
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    const d = getDb();
    const val = (d as any)[prop];
    return typeof val === "function" ? val.bind(d) : val;
  },
});

/**
 * Proxy lazy pour `client` (utilisé par init.ts / migrate.ts).
 */
export const client = new Proxy({} as Client, {
  get(_target, prop) {
    const c = getClient();
    const val = (c as any)[prop];
    return typeof val === "function" ? val.bind(c) : val;
  },
});

export { schema };

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.js";
import * as dotenv from "dotenv";

dotenv.config();

// Turso (remote) en production, SQLite local pour le dev
const url = process.env.TURSO_DATABASE_URL || "file:./meeting_recorder.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

export const client = createClient({ url, authToken });
export const db = drizzle(client, { schema });
export { schema };

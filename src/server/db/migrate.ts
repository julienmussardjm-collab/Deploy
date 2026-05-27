import { initDb } from "./init.js";
import { client } from "./index.js";
import * as dotenv from "dotenv";

dotenv.config();

await initDb();
await client.close();
console.log("✅ Base de données initialisée :", process.env.TURSO_DATABASE_URL || "file:./meeting_recorder.db");

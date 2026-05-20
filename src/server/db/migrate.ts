import Database from "better-sqlite3";
import * as dotenv from "dotenv";

dotenv.config();

const dbPath = process.env.DATABASE_URL || "./meeting_recorder.db";
const sqlite = new Database(dbPath);

sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    open_id TEXT UNIQUE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    last_signed_in INTEGER
  );

  CREATE TABLE IF NOT EXISTS meetings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    recorder_name TEXT,
    title TEXT NOT NULL,
    audio_url TEXT NOT NULL,
    audio_key TEXT NOT NULL,
    transcription TEXT,
    summary TEXT,
    key_points TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
`);

sqlite.close();
console.log("✅ Base de données initialisée :", dbPath);

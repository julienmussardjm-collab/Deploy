import { client } from "./index.js";

export async function initDb(): Promise<void> {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      open_id TEXT UNIQUE,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      last_signed_in INTEGER
    )
  `);

  await client.execute(`
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
    )
  `);

  console.log("[DB] tables ready");
}

// Module-level cached promise — shared across all requests on a warm instance.
// On a cold start it is null, so the first request triggers init.
let _initPromise: Promise<void> | null = null;

/**
 * Ensures the DB schema is initialised before the caller continues.
 * Safe to call concurrently: all callers share the same promise.
 * Resets on failure so the next request retries automatically.
 */
export function ensureDbInit(): Promise<void> {
  if (!_initPromise) {
    _initPromise = initDb().catch((err) => {
      console.error("[DB] ensureDbInit failed:", err);
      _initPromise = null; // allow retry on next request
      throw err;
    });
  }
  return _initPromise;
}

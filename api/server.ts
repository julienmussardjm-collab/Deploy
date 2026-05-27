import { createApp } from "../src/server/app.js";
import { initDb } from "../src/server/db/init.js";

// Initialise les tables au démarrage ; chaque requête attend la fin
// On garde la promesse de rejet pour que le middleware puisse la propager
const dbReady = initDb().catch((err) => {
  console.error("[DB] init failed:", err);
  throw err; // re-throw so the per-request middleware sends a JSON 500
});

const app = createApp(dbReady);

export default app;

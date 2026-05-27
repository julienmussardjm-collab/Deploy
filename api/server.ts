import { createApp } from "../src/server/app.js";
import { initDb } from "../src/server/db/init.js";

// Initialise les tables au démarrage ; chaque requête attend la fin
const dbReady = initDb().catch((err) => {
  console.error("[DB] init failed:", err);
});

const app = createApp(dbReady);

export default app;

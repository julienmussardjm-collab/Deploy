import { createApp } from "../src/server/app.js";
import { initDb } from "../src/server/db/init.js";

// Création des tables en arrière-plan (tables Turso persistent entre déploiements).
// On ne bloque PAS les requêtes sur cette promesse — si elle traîne (WebSocket, réseau),
// les requêtes ne doivent pas attendre indéfiniment.
initDb().catch((err) => {
  console.error("[DB] init failed:", err);
});

// Pas de dbReady → les requêtes passent immédiatement
const app = createApp();

export default app;

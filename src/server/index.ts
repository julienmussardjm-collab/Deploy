import { createApp } from "./app.js";
import * as dotenv from "dotenv";

dotenv.config();

const PORT = parseInt(process.env.PORT || "3000", 10);

export const app = createApp();

// Only listen when running directly (not on Vercel)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`✅ Meeting Recorder démarré sur http://localhost:${PORT}`);
    if (process.env.NODE_ENV === "development") {
      console.log(`🎨 Interface : http://localhost:5173`);
    }
  });
}

export default app;
export { appRouter } from "./routers/index.js";
export type { AppRouter } from "./routers/index.js";

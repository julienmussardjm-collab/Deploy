import { createApp } from "../src/server/app.js";

// Initialize database tables on cold start
import "../src/server/db/init.js";

const app = createApp();

export default app;

import { createApp } from "../src/server/app.js";

// DB initialisation is now handled by a middleware inside createApp().
// Each request awaits ensureDbInit() before reaching any route handler,
// so tables are guaranteed to exist by the time a query runs.
const app = createApp();

export default app;

import { router } from "../trpc.js";
import { meetingsRouter } from "./meetings.js";
import { uploadRouter } from "./upload.js";
import { authRouter } from "./auth.js";

export const appRouter = router({
  meetings: meetingsRouter,
  upload: uploadRouter,
  auth: authRouter,
});

export type AppRouter = typeof appRouter;

import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../../server/routers/index.js";

export const trpc = createTRPCReact<AppRouter>();

function getBaseUrl() {
  // In browser, use relative URL (proxied by Vite dev server)
  if (typeof window !== "undefined") {
    return "";
  }
  // In SSR or Node, use absolute URL
  return `http://localhost:${process.env.PORT || 3000}`;
}

export function getTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${getBaseUrl()}/trpc`,
        headers() {
          const token =
            typeof window !== "undefined"
              ? localStorage.getItem("auth_token")
              : null;
          if (token) {
            return { Authorization: `Bearer ${token}` };
          }
          return {};
        },
      }),
    ],
  });
}

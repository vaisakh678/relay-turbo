import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { env } from "./config/env";
import { APIError, type ResponseMeta } from "./lib/api-error";
import { auth, enabledSocialProviders } from "./lib/auth";
import { logger } from "./lib/logger";
import type { APIResponse } from "./lib/types";
import { requireWorkspace, type AppEnv } from "./middleware/auth";
import appRoutes from "./routes";

// Routes that don't use the dashboard session: health checks, and /chat,
// which apps call from any origin with their own bearer tokens.
const PUBLIC_V1 = [/^\/api\/v1\/health(\/|$)/, /^\/api\/v1\/chat(\/|$)/, /^\/api\/v1\/auth-config(\/|$)/];

export function createApp() {
  const app = new Hono<AppEnv>();
  app.use(honoLogger());

  // Dashboard + auth routes carry session cookies, so only the dashboard's
  // origins may call them with credentials. /chat (bearer tokens, no cookies)
  // is open to any origin so client apps can call it directly.
  app.use(
    "*",
    cors({
      origin: (origin, c) =>
        c.req.path.startsWith("/api/v1/chat") ? origin || "*" : env.WEB_ORIGINS.includes(origin) ? origin : null,
      credentials: true,
    }),
  );

  app.onError((err, c) => {
    if (err instanceof APIError) {
      return c.json<APIResponse<null, ResponseMeta>>(
        { data: null, error: err.message, meta: err.meta },
        err.statusCode as ContentfulStatusCode,
      );
    }
    logger.error({ err, method: c.req.method, path: c.req.path }, "Unhandled error");
    return c.json<APIResponse<null>>({ data: null, error: "Internal server error" }, 500);
  });

  app.get("/", (c) => c.json<APIResponse<{ name: string }>>({ data: { name: "Relay API" } }));

  // Better Auth: sign up/in/out, OAuth callbacks, sessions, workspaces (organization plugin)
  app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

  // Which sign-in methods the login page should offer
  app.get("/api/v1/auth-config", (c) =>
    c.json<APIResponse<{ emailOtp: true; google: boolean; github: boolean }>>({
      data: { emailOtp: true, ...enabledSocialProviders },
    }),
  );

  app.use("/api/v1/*", async (c, next) =>
    PUBLIC_V1.some((re) => re.test(c.req.path)) ? next() : requireWorkspace(c, next),
  );

  app.route("/api/v1", appRoutes);

  return app;
}

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { APIError, type ResponseMeta } from "./lib/api-error";
import { logger } from "./lib/logger";
import type { APIResponse } from "./lib/types";
import appRoutes from "./routes";

// TODO(auth): no auth yet — every /api/v1 route is open. Dashboard routes need
// a session; /chat needs the app-signed token instead of body-asserted identity.
export function createApp() {
  const app = new Hono();
  app.use(honoLogger());
  app.use("*", cors());

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

  app.route("/api/v1", appRoutes);

  return app;
}

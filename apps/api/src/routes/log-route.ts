import { validate } from "../lib/validate";
import { Hono } from "hono";
import { z } from "zod";

import type { APIResponse } from "../lib/types";
import { logListQuerySchema } from "../lib/validators";
import { getStats, getTimeseries, listLogs } from "../services/log-service";

const logRoute = new Hono()
  // GET /api/v1/logs?appId=&status=&cursor=&limit= — newest first
  .get("/", validate("query", logListQuerySchema), async (c) => {
    const logs = await listLogs(c.req.valid("query"));
    return c.json<APIResponse<typeof logs>>({ data: logs });
  })
  // GET /api/v1/logs/stats?hours=24 — per-app totals for the overview
  .get("/stats", validate("query", z.object({ hours: z.coerce.number().int().min(1).max(720).default(24) })), async (c) => {
    const stats = await getStats(c.req.valid("query").hours);
    return c.json<APIResponse<typeof stats>>({ data: stats });
  })
  // GET /api/v1/logs/timeseries?hours=24 — hourly request counts per app
  .get("/timeseries", validate("query", z.object({ hours: z.coerce.number().int().min(1).max(168).default(24) })), async (c) => {
    const series = await getTimeseries(c.req.valid("query").hours);
    return c.json<APIResponse<typeof series>>({ data: series });
  });

export default logRoute;


import { serve } from "@hono/node-server";

import "./config/env";
import { createApp } from "./app";
import { logger } from "./lib/logger";

const app = createApp();

// Railway (and most hosts) inject the port via $PORT; fall back to 3001 for local dev.
const port = Number(process.env.PORT) || 3001;

const server = serve({ fetch: app.fetch, port }, (info) => {
  logger.info({ port: info.port }, `Server running at http://localhost:${info.port}`);
});

const shutdown = () => {
  server.close(() => process.exit(0));
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

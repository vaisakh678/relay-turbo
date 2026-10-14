import { validate } from "../lib/validate";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

import { chatRequestSchema } from "../lib/validators";
import { prepareChat, runChat } from "../services/chat-service";
import { authenticateChat } from "../services/token-service";

// Proxies (and some load balancers) drop SSE connections that stay silent too
// long, e.g. while a slow model is thinking. A comment line keeps it open.
const HEARTBEAT_MS = 15_000;

const chatRoute = new Hono()
  // POST /api/v1/chat — stream one reply as SSE.
  // Auth: `Authorization: Bearer <jwt>` signed with the app's secret (live, test or playground).
  // Events: start, delta, usage, error, done (see @repo/dto RelayEvent).
  // Pre-stream failures (bad token, paused, rate limited, no key) are plain HTTP errors.
  .post("/", validate("json", chatRequestSchema), async (c) => {
    const auth = await authenticateChat(c.req.header("Authorization"));
    const chat = await prepareChat(auth, c.req.valid("json"));

    // Stop buffering in nginx-style proxies so tokens arrive as they're written.
    c.header("X-Accel-Buffering", "no");
    c.header("Cache-Control", "no-cache, no-transform");

    return streamSSE(c, async (s) => {
      const controller = new AbortController();
      s.onAbort(() => controller.abort());
      const heartbeat = setInterval(() => void s.write(": ping\n\n").catch(() => {}), HEARTBEAT_MS);
      try {
        await runChat(
          chat,
          (e) => s.writeSSE({ event: e.event, data: JSON.stringify(e.data) }),
          controller.signal,
        );
      } finally {
        clearInterval(heartbeat);
      }
    });
  });

export default chatRoute;

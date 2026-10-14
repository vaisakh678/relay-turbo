import { validate } from "../lib/validate";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

import { chatRequestSchema } from "../lib/validators";
import { prepareChat, runChat } from "../services/chat-service";

// Proxies (and some load balancers) drop SSE connections that stay silent too
// long, e.g. while a slow model is thinking. A comment line keeps it open.
const HEARTBEAT_MS = 15_000;

const chatRoute = new Hono()
  // POST /api/v1/chat — stream one reply as SSE.
  // Events: start, delta, usage, error, done (see lib/events.ts).
  // Pre-stream failures (unknown app, paused, rate limited, no key) are plain HTTP errors.
  .post("/", validate("json", chatRequestSchema), async (c) => {
    const chat = await prepareChat(c.req.valid("json"));

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

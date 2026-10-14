// End-to-end check of the chat pipeline without a real provider key:
// mock model → SSE events → request log → signed webhook → daily limit.
//   pnpm --filter @relay/api smoke
// Uses the seeded "luna-stories" app (free plan: 3 messages/day) and cleans up after itself.
import { createHmac, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import db, { appSchema, pool, providerKeySchema, requestLogSchema } from "@repo/db";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { and, eq } from "drizzle-orm";

import { APIError } from "../src/lib/api-error";
import type { RelayEvent } from "../src/lib/events";
import { findAppBySlug } from "../src/services/app-service";
import { prepareChat, runChat } from "../src/services/chat-service";

const mockModel = () =>
  new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: "text-start", id: "t1" },
          { type: "text-delta", id: "t1", delta: "Once upon " },
          { type: "text-delta", id: "t1", delta: "a time." },
          { type: "text-end", id: "t1" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: undefined },
            logprobs: undefined,
            usage: {
              inputTokens: { total: 120, noCache: 120, cacheRead: undefined, cacheWrite: undefined },
              outputTokens: { total: 6, text: 6, reasoning: undefined },
            },
          },
        ],
      }),
    }),
  });

function check(ok: unknown, label: string) {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  const app = await findAppBySlug("luna-stories");
  if (!app) throw new Error("Run `pnpm --filter @repo/db db:seed` first");
  const user = `smoke_${randomUUID().slice(0, 8)}`;

  // Webhook receiver that verifies Relay's signature
  const received: { valid: boolean; body: any }[] = [];
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d)).on("end", () => {
      const ts = req.headers["x-relay-timestamp"];
      const expected = createHmac("sha256", app.signingSecret).update(`${ts}.${body}`).digest("hex");
      received.push({ valid: expected === req.headers["x-relay-signature"], body: JSON.parse(body) });
      res.end("ok");
    });
  });
  await new Promise<void>((r) => server.listen(0, r));
  const webhookUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`;

  const hadKey = (await db.select().from(providerKeySchema).where(eq(providerKeySchema.provider, app.provider))).length > 0;
  if (!hadKey) await db.insert(providerKeySchema).values({ provider: app.provider, apiKey: "smoke-test-placeholder-key" });
  await db.update(appSchema).set({ webhookUrl }).where(eq(appSchema.id, app.id));

  try {
    const request = { app: app.slug, user, plan: "free", vars: { child_name: "Mia" }, messages: [{ role: "user" as const, content: "Tell me a story" }] };

    // 1. One full stream
    const events: RelayEvent[] = [];
    const chat = await prepareChat(request);
    await runChat(chat, async (e) => void events.push(e), new AbortController().signal, mockModel());
    const names = events.map((e) => e.event);
    check(JSON.stringify(names) === JSON.stringify(["start", "delta", "delta", "usage", "done"]), `events: ${names.join(", ")}`);
    const text = events.flatMap((e) => (e.event === "delta" ? [e.data.text] : [])).join("");
    check(text === "Once upon a time.", `streamed text: "${text}"`);

    const [log] = await db.select().from(requestLogSchema).where(eq(requestLogSchema.id, chat.id));
    check(log?.status === "ok" && log.inputTokens === 120 && log.outputTokens === 6, `log row: status=${log?.status} tokens=${log?.inputTokens}/${log?.outputTokens} cost=${log?.costMicros}µ$ ttft=${log?.ttftMs}ms`);

    await new Promise((r) => setTimeout(r, 300));
    check(received.length === 1 && received[0]!.valid, `webhook delivered with valid signature`);
    check(received[0]?.body.message.content === "Once upon a time." && received[0]?.body.user === user, `webhook payload has message + user`);

    // 2. Free plan allows 3/day: two more succeed, the 4th is rejected
    for (let i = 0; i < 2; i++) await runChat(await prepareChat(request), async () => {}, new AbortController().signal, mockModel());
    try {
      await prepareChat(request);
      check(false, "4th request should be rate limited");
    } catch (err) {
      check(err instanceof APIError && err.statusCode === 429, `4th request → ${err instanceof APIError ? err.statusCode : err} (${(err as Error).message}), resetAt=${(err as APIError).meta?.resetAt}`);
    }
    const limited = await db.select().from(requestLogSchema).where(and(eq(requestLogSchema.externalUserId, user), eq(requestLogSchema.status, "rate_limited")));
    check(limited.length === 1, `rate_limited request logged`);
  } finally {
    await db.delete(requestLogSchema).where(eq(requestLogSchema.externalUserId, user));
    await db.update(appSchema).set({ webhookUrl: app.webhookUrl }).where(eq(appSchema.id, app.id));
    if (!hadKey) await db.delete(providerKeySchema).where(eq(providerKeySchema.provider, app.provider));
    server.close();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

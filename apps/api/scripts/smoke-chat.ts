// End-to-end check of auth + the chat pipeline without a real provider key:
// tokens → mock model → SSE events → request log → signed webhook → limits.
//   pnpm --filter @relay/api smoke
// Uses the seeded "luna-stories" app (free plan: 3 messages/day) and cleans up after itself.
import { createHmac, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import db, { appSchema, pool, providerKeySchema, requestLogSchema, testTokenSchema } from "@repo/db";
import type { RelayEvent } from "@repo/dto";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { and, eq, gte } from "drizzle-orm";
import { SignJWT } from "jose";

import { APIError } from "../src/lib/api-error";
import { signToken } from "../src/lib/tokens";
import { findAppBySlug } from "../src/services/app-service";
import { prepareChat, runChat, TEST_TOKEN_DAILY_CAP } from "../src/services/chat-service";
import { authenticateChat, createPlaygroundToken, createTestToken, revokeTestToken } from "../src/services/token-service";

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

/** Run fn, expect an APIError with this status; returns its message. */
async function expectStatus(status: number, fn: () => Promise<unknown>, label: string) {
  try {
    await fn();
    check(false, `${label} → expected ${status}, got success`);
  } catch (err) {
    const got = err instanceof APIError ? err.statusCode : String(err);
    check(got === status, `${label} → ${got} (${(err as Error).message})`);
  }
}

const bearer = (t: string) => `Bearer ${t}`;
const inMinutes = (m: number) => new Date(Date.now() + m * 60_000);

async function main() {
  const app = await findAppBySlug("luna-stories");
  if (!app) throw new Error("Run `pnpm --filter @repo/db db:seed` first");
  const user = `smoke_${randomUUID().slice(0, 8)}`;
  const startedAt = new Date();

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
  await db.update(appSchema).set({ webhookUrl, allowTestTokens: false }).where(eq(appSchema.id, app.id));

  try {
    console.log("— auth");
    const live = await signToken(app.signingSecret, { app: app.slug, sub: user, plan: "free", vars: { child_name: "Mia" } }, inMinutes(5));
    const liveAuth = await authenticateChat(bearer(live));
    check(liveAuth.kind === "live" && liveAuth.user === user && liveAuth.plan === "free", `live token → kind=${liveAuth.kind} user ok`);

    await expectStatus(401, () => authenticateChat(undefined), "no token");
    await expectStatus(401, () => authenticateChat("Bearer not-a-jwt"), "garbage token");
    const forged = await signToken("wrong-secret-wrong-secret", { app: app.slug, sub: user, plan: "pro" }, inMinutes(5));
    await expectStatus(401, () => authenticateChat(bearer(forged)), "token signed with the wrong secret");
    const expired = await new SignJWT({ app: app.slug, plan: "free" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 300)
      .sign(new TextEncoder().encode(app.signingSecret));
    await expectStatus(401, () => authenticateChat(bearer(expired)), "expired token");
    const tooLong = await signToken(app.signingSecret, { app: app.slug, sub: user, plan: "free" }, inMinutes(48 * 60));
    await expectStatus(401, () => authenticateChat(bearer(tooLong)), "live token living 48h");

    const pg = await createPlaygroundToken(app.id, { user, plan: "free", vars: {} });
    check((await authenticateChat(bearer(pg.token))).kind === "playground", "playground token accepted while test tokens are disabled");

    const { token: testToken, testToken: testMeta } = await createTestToken(app.id, {
      label: "smoke",
      user,
      plan: "free",
      vars: {},
      expiresIn: "1h",
    });
    await expectStatus(403, () => authenticateChat(bearer(testToken)), "test token while app has them disabled");
    await db.update(appSchema).set({ allowTestTokens: true }).where(eq(appSchema.id, app.id));
    const testAuth = await authenticateChat(bearer(testToken));
    check(testAuth.kind === "test" && testAuth.testTokenId === testMeta.id, "test token accepted once enabled");
    await revokeTestToken(app.id, testMeta.id);
    await expectStatus(401, () => authenticateChat(bearer(testToken)), "revoked test token");

    console.log("— stream");
    const events: RelayEvent[] = [];
    const chat = await prepareChat(liveAuth, {
      vars: { child_name: "Hacker", favorite_animal: "owl" },
      messages: [{ role: "user", content: "Tell me a story" }],
    });
    check(chat.vars.child_name === "Mia" && chat.vars.favorite_animal === "owl", "token vars override client vars; client-only vars kept");
    await runChat(chat, async (e) => void events.push(e), new AbortController().signal, mockModel());
    const names = events.map((e) => e.event);
    check(JSON.stringify(names) === JSON.stringify(["start", "delta", "delta", "usage", "done"]), `events: ${names.join(", ")}`);

    const [log] = await db.select().from(requestLogSchema).where(eq(requestLogSchema.id, chat.id));
    check(log?.status === "ok" && log.tokenKind === "live" && log.outputTokens === 6, `log row: status=${log?.status} kind=${log?.tokenKind} cost=${log?.costMicros}µ$`);

    await new Promise((r) => setTimeout(r, 300));
    check(received.length === 1 && received[0]!.valid && received[0]!.body.tokenKind === "live", "webhook delivered, signature valid, kind=live");

    const pgChat = await prepareChat(await authenticateChat(bearer(pg.token)), { vars: {}, messages: [{ role: "user", content: "hi" }] });
    await runChat(pgChat, async () => {}, new AbortController().signal, mockModel());
    await new Promise((r) => setTimeout(r, 300));
    check(received.length === 1, "playground chats don't send webhooks");

    console.log("— limits");
    // 2 chats used by `user` so far (live + playground); free plan allows 3
    await runChat(await prepareChat(liveAuth, { vars: {}, messages: [{ role: "user", content: "hi" }] }), async () => {}, new AbortController().signal, mockModel());
    try {
      await prepareChat(liveAuth, { vars: {}, messages: [{ role: "user", content: "hi" }] });
      check(false, "4th request should be rate limited");
    } catch (err) {
      check(err instanceof APIError && err.statusCode === 429 && err.meta?.code === "rate_limited", `4th request → 429 rate_limited, resetAt=${(err as APIError).meta?.resetAt}`);
    }

    // Fill today's test-token cap with synthetic rows, then a fresh test token is refused
    const { token: t2, testToken: t2Meta } = await createTestToken(app.id, { label: "cap", user: `${user}_cap`, plan: "pro", vars: {}, expiresIn: "1h" });
    await db.insert(requestLogSchema).values(
      Array.from({ length: TEST_TOKEN_DAILY_CAP }, () => ({
        appId: app.id,
        externalUserId: `${user}_filler`,
        plan: "pro",
        tokenKind: "test" as const,
        testTokenId: t2Meta.id,
        provider: app.provider,
        model: app.model,
        promptVersion: 1,
        status: "ok" as const,
        durationMs: 1,
      })),
    );
    try {
      await prepareChat(await authenticateChat(bearer(t2)), { vars: {}, messages: [{ role: "user", content: "hi" }] });
      check(false, "test cap should block");
    } catch (err) {
      check(err instanceof APIError && err.statusCode === 429 && err.meta?.code === "test_cap", `test token after ${TEST_TOKEN_DAILY_CAP} test requests → 429 test_cap`);
    }
  } finally {
    await db.delete(requestLogSchema).where(and(eq(requestLogSchema.appId, app.id), gte(requestLogSchema.createdAt, startedAt)));
    await db.delete(testTokenSchema).where(and(eq(testTokenSchema.appId, app.id), gte(testTokenSchema.createdAt, startedAt)));
    await db.update(appSchema).set({ webhookUrl: app.webhookUrl, allowTestTokens: app.allowTestTokens }).where(eq(appSchema.id, app.id));
    if (!hadKey) await db.delete(providerKeySchema).where(eq(providerKeySchema.provider, app.provider));
    server.close();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

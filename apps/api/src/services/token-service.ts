import db, { testTokenSchema, type AppRow, type TestTokenRow } from "@repo/db";
import type { TestTokenDTO } from "@repo/dto";
import { and, desc, eq } from "drizzle-orm";

import { BadRequest, Forbidden, NotFound, Unauthorized } from "../lib/api-error";
import { logger } from "../lib/logger";
import { peekApp, signToken, TokenError, verifyToken, type TokenKind } from "../lib/tokens";
import type { CreateTestTokenInput, PlaygroundTokenInput } from "../lib/validators";
import { findAppBySlug, getPlanLimit, requireApp } from "./app-service";

export type ChatAuth = {
  app: AppRow;
  user: string;
  plan: string;
  vars: Record<string, string>;
  kind: TokenKind;
  testTokenId: string | null;
};

const EXPIRES_IN_MS = { "1h": 3_600_000, "1d": 86_400_000, "7d": 7 * 86_400_000 } as const;
const PLAYGROUND_TTL_MS = 5 * 60_000;

/** Resolve `Authorization: Bearer <token>` into the app + identity for a chat request. */
export async function authenticateChat(authorization: string | undefined): Promise<ChatAuth> {
  const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) throw Unauthorized("Missing bearer token");

  const slug = peekApp(token);
  const app = slug ? await findAppBySlug(slug) : undefined;
  // Same message for unknown app and bad signature: don't confirm which slugs exist.
  if (!app) throw Unauthorized("Invalid token");

  let claims;
  try {
    claims = await verifyToken(token, app.signingSecret);
  } catch (err) {
    throw Unauthorized(err instanceof TokenError ? err.message : "Invalid token");
  }
  const kind = claims.kind ?? "live";

  let testTokenId: string | null = null;
  if (kind === "test") {
    if (!app.allowTestTokens) throw Forbidden(`Test tokens are disabled for "${app.slug}"`);
    if (!claims.jti) throw Unauthorized("Invalid token");
    const [row] = await db
      .select({ id: testTokenSchema.id, revokedAt: testTokenSchema.revokedAt })
      .from(testTokenSchema)
      .where(and(eq(testTokenSchema.id, claims.jti), eq(testTokenSchema.appId, app.id)))
      .limit(1);
    if (!row || row.revokedAt) throw Unauthorized("Token revoked");
    testTokenId = row.id;
    void db
      .update(testTokenSchema)
      .set({ lastUsedAt: new Date() })
      .where(eq(testTokenSchema.id, row.id))
      .catch((err) => logger.warn({ err }, "Failed to update test token last_used_at"));
  }

  return { app, user: claims.sub, plan: claims.plan, vars: claims.vars ?? {}, kind, testTokenId };
}

function testTokenToDTO(row: TestTokenRow): TestTokenDTO {
  const now = Date.now();
  return {
    id: row.id,
    label: row.label,
    user: row.externalUserId,
    plan: row.plan,
    vars: row.vars,
    status: row.revokedAt ? "revoked" : row.expiresAt.getTime() <= now ? "expired" : "active",
    expiresAt: row.expiresAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

async function requirePlan(appId: string, plan: string) {
  if (!(await getPlanLimit(appId, plan))) throw BadRequest(`Unknown plan "${plan}" for this app`);
}

export async function listTestTokens(appId: string): Promise<TestTokenDTO[]> {
  await requireApp(appId);
  const rows = await db
    .select()
    .from(testTokenSchema)
    .where(eq(testTokenSchema.appId, appId))
    .orderBy(desc(testTokenSchema.createdAt));
  return rows.map(testTokenToDTO);
}

/** Returns the token string exactly once; only its metadata is stored. */
export async function createTestToken(appId: string, input: CreateTestTokenInput): Promise<{ token: string; testToken: TestTokenDTO }> {
  const app = await requireApp(appId);
  await requirePlan(app.id, input.plan);

  const [row] = await db
    .insert(testTokenSchema)
    .values({
      appId: app.id,
      label: input.label,
      externalUserId: input.user,
      plan: input.plan,
      vars: input.vars,
      expiresAt: new Date(Date.now() + EXPIRES_IN_MS[input.expiresIn]),
    })
    .returning();

  const token = await signToken(
    app.signingSecret,
    { app: app.slug, sub: row!.externalUserId, plan: row!.plan, vars: row!.vars, kind: "test", jti: row!.id },
    row!.expiresAt,
  );
  return { token, testToken: testTokenToDTO(row!) };
}

export async function revokeTestToken(appId: string, tokenId: string): Promise<TestTokenDTO> {
  await requireApp(appId);
  const [row] = await db
    .update(testTokenSchema)
    .set({ revokedAt: new Date() })
    .where(and(eq(testTokenSchema.id, tokenId), eq(testTokenSchema.appId, appId)))
    .returning();
  if (!row) throw NotFound("Test token not found");
  return testTokenToDTO(row);
}

/** 5-minute token for the dashboard Playground. Works even when test tokens are disabled. */
export async function createPlaygroundToken(appId: string, input: PlaygroundTokenInput): Promise<{ token: string; expiresAt: string }> {
  const app = await requireApp(appId);
  await requirePlan(app.id, input.plan);
  const expiresAt = new Date(Date.now() + PLAYGROUND_TTL_MS);
  const token = await signToken(
    app.signingSecret,
    { app: app.slug, sub: input.user, plan: input.plan, vars: input.vars, kind: "playground" },
    expiresAt,
  );
  return { token, expiresAt: expiresAt.toISOString() };
}

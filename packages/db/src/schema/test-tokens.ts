import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { appSchema } from "./apps";
import { createdAt, id } from "./helpers";

// Dashboard-issued tokens for testing an app without its backend.
// The row ID is the token's `jti`; the token string itself is never stored
// (it's shown once on creation). Revoking sets revoked_at, which the gateway
// checks on every request that presents a test token.
export const testTokenSchema = pgTable(
  "test_tokens",
  {
    id: id(),
    appId: uuid("app_id")
      .notNull()
      .references(() => appSchema.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    externalUserId: text("external_user_id").notNull(),
    plan: text("plan").notNull(),
    vars: jsonb("vars").$type<Record<string, string>>().notNull().default({}),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  // Listing an app's tokens newest-first; also covers the FK.
  (t) => [index("test_tokens_app_created_idx").on(t.appId, t.createdAt)],
);

export type TestTokenRow = typeof testTokenSchema.$inferSelect;
export type NewTestTokenRow = typeof testTokenSchema.$inferInsert;

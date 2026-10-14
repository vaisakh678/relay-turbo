import { bigint, index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { appSchema } from "./apps";
import { providerEnum, requestStatusEnum, tokenKindEnum } from "./enums";
import { createdAt, id } from "./helpers";
import { testTokenSchema } from "./test-tokens";

// One row per stream through the gateway. Metadata only: message content is
// never stored here (it goes to the app's webhook instead).
export const requestLogSchema = pgTable(
  "request_logs",
  {
    id: id(),
    appId: uuid("app_id")
      .notNull()
      .references(() => appSchema.id, { onDelete: "cascade" }),
    // The app's own user ID, from the token's `sub` claim. Opaque to Relay.
    externalUserId: text("external_user_id").notNull(),
    plan: text("plan").notNull(),
    tokenKind: tokenKindEnum("token_kind").notNull().default("live"),
    // Set when a dashboard test token was used; kept null if the token is later deleted.
    testTokenId: uuid("test_token_id").references(() => testTokenSchema.id, { onDelete: "set null" }),

    provider: providerEnum("provider").notNull(),
    model: text("model").notNull(),
    promptVersion: integer("prompt_version").notNull(),
    status: requestStatusEnum("status").notNull(),

    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    // Null when no token was ever produced (rate limited, early error).
    ttftMs: integer("ttft_ms"),
    durationMs: integer("duration_ms").notNull(),
    // Spend in millionths of a dollar: exact integer math, no float drift.
    costMicros: bigint("cost_micros", { mode: "number" }).notNull().default(0),
    error: text("error"),

    createdAt: createdAt(),
  },
  (t) => [
    // Per-app log listing + stats over a time window; also covers the FK.
    index("request_logs_app_created_idx").on(t.appId, t.createdAt),
    // Daily limit check: count(*) where app_id = ? and external_user_id = ? and created_at >= today
    index("request_logs_app_user_created_idx").on(t.appId, t.externalUserId, t.createdAt),
    // Cross-app log listing (dashboard "All apps").
    index("request_logs_created_idx").on(t.createdAt),
    // FK index (set-null on token delete) + per-token usage lookups.
    index("request_logs_test_token_idx").on(t.testTokenId),
  ],
);

export type RequestLogRow = typeof requestLogSchema.$inferSelect;
export type NewRequestLogRow = typeof requestLogSchema.$inferInsert;

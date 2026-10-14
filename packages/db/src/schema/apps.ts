import { sql } from "drizzle-orm";
import {
  check,
  integer,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { appStatusEnum, providerEnum } from "./enums";
import { createdAt, id, updatedAt } from "./helpers";

// One connected client app (e.g. Luna Stories). Holds the model config and
// the secret its backend uses to sign Relay tokens.
export const appSchema = pgTable(
  "apps",
  {
    id: id(),
    name: text("name").notNull(),
    // Public identifier used in tokens and the chat API ("luna-stories").
    slug: text("slug").notNull(),
    emoji: text("emoji").notNull().default("✨"),
    status: appStatusEnum("status").notNull().default("paused"),

    provider: providerEnum("provider").notNull(),
    model: text("model").notNull(),
    temperature: real("temperature").notNull().default(0.7),

    // Where Relay POSTs the finished message + usage after each stream.
    webhookUrl: text("webhook_url"),
    signingSecret: text("signing_secret").notNull(),

    // Version number of the prompt currently served (see prompt_versions).
    activePromptVersion: integer("active_prompt_version").notNull().default(1),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    // Slugs are unique among non-deleted apps, so a deleted slug can be reused.
    uniqueIndex("apps_slug_key").on(t.slug).where(sql`${t.deletedAt} is null`),
    check("apps_temperature_range", sql`${t.temperature} between 0 and 2`),
  ],
);

// Immutable history of an app's system prompt. Publishing inserts a new row
// and bumps apps.active_prompt_version; rollback just points it at an older one.
export const promptVersionSchema = pgTable(
  "prompt_versions",
  {
    id: id(),
    appId: uuid("app_id")
      .notNull()
      .references(() => appSchema.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    content: text("content").notNull(),
    note: text("note").notNull().default(""),
    createdAt: createdAt(),
  },
  // The unique index also serves FK lookups (app_id is its leading column).
  (t) => [uniqueIndex("prompt_versions_app_version_key").on(t.appId, t.version)],
);

// Per-plan usage limits, keyed by the `plan` claim the app's backend puts in
// the token ("free", "pro", ...).
export const planLimitSchema = pgTable(
  "plan_limits",
  {
    id: id(),
    appId: uuid("app_id")
      .notNull()
      .references(() => appSchema.id, { onDelete: "cascade" }),
    plan: text("plan").notNull(),
    messagesPerDay: integer("messages_per_day").notNull(),
    maxOutputTokens: integer("max_output_tokens").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("plan_limits_app_plan_key").on(t.appId, t.plan),
    check("plan_limits_messages_nonneg", sql`${t.messagesPerDay} >= 0`),
    check("plan_limits_tokens_positive", sql`${t.maxOutputTokens} > 0`),
  ],
);

export type AppRow = typeof appSchema.$inferSelect;
export type NewAppRow = typeof appSchema.$inferInsert;
export type PromptVersionRow = typeof promptVersionSchema.$inferSelect;
export type PlanLimitRow = typeof planLimitSchema.$inferSelect;


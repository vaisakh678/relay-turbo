import { pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";

import { workspaceSchema } from "./auth";
import { providerEnum } from "./enums";
import { createdAt, updatedAt } from "./helpers";

// One API key per LLM provider per workspace, shared by that workspace's apps.
// TODO: encrypt at rest (envelope encryption with a KMS/master key) before
// this holds real keys outside local dev.
export const providerKeySchema = pgTable(
  "provider_keys",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaceSchema.id, { onDelete: "cascade" }),
    provider: providerEnum("provider").notNull(),
    apiKey: text("api_key").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  // PK leads with workspace_id, so it also serves the FK.
  (t) => [primaryKey({ name: "provider_keys_pkey", columns: [t.workspaceId, t.provider] })],
);

export type ProviderKeyRow = typeof providerKeySchema.$inferSelect;

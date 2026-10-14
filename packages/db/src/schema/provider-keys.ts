import { pgTable, text } from "drizzle-orm/pg-core";

import { providerEnum } from "./enums";
import { createdAt, updatedAt } from "./helpers";

// One API key per LLM provider, shared by every app.
// TODO: encrypt at rest (envelope encryption with a KMS/master key) before
// this holds real keys outside local dev.
export const providerKeySchema = pgTable("provider_keys", {
  provider: providerEnum("provider").primaryKey(),
  apiKey: text("api_key").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type ProviderKeyRow = typeof providerKeySchema.$inferSelect;

import { timestamp, uuid } from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";

// UUIDv7 is time-ordered, so inserts stay append-only in the PK index
// (random v4 scatters writes, which hurts on high-volume tables like logs).
export const id = () => uuid("id").primaryKey().$defaultFn(() => uuidv7());

export const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

export * from "./schema";

// Pass DATABASE_URL through untouched. `sslmode=no-verify` parses to
// `ssl: { rejectUnauthorized: false }` for managed Postgres; no-op locally.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

const db = drizzle({ client: pool, schema });

export default db;
export { pool };

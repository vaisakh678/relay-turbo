import { z } from "zod";

try {
  process.loadEnvFile();
} catch {
  // .env not found — fine if required vars are already in process.env.
}

const envSchema = z.object({
  DATABASE_URL: z.url(),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
    .default("info"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

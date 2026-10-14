import { z } from "zod";

try {
  process.loadEnvFile();
} catch {
  // .env not found — fine if required vars are already in process.env.
}

const optional = z
  .string()
  .optional()
  .transform((v) => v || undefined);

const envSchema = z.object({
  DATABASE_URL: z.url(),

  // Better Auth (dashboard sign-in)
  BETTER_AUTH_SECRET: z.string().min(32, "Use at least 32 random characters (openssl rand -base64 48)"),
  BETTER_AUTH_URL: z.url().default("http://localhost:3001"),
  WEB_ORIGINS: z
    .string()
    .default("http://localhost:5173")
    .transform((v) => v.split(",").map((o) => o.trim()).filter(Boolean)),
  // Social sign-in is enabled per provider only when both values are set.
  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,
  GITHUB_CLIENT_ID: optional,
  GITHUB_CLIENT_SECRET: optional,
  // Transactional email (sign-in codes). Unset in local dev: codes are logged instead.
  RESEND_API_KEY: optional,
  EMAIL_FROM: optional,

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

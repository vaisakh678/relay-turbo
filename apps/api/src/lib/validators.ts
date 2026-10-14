import { z } from "zod";

export const providerSchema = z.enum(["anthropic", "openai", "google"]);

const slugSchema = z
  .string()
  .min(2)
  .max(48)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Lowercase letters, numbers and single dashes only");

export const createAppSchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: slugSchema.optional(),
  emoji: z.string().min(1).max(8).default("✨"),
  provider: providerSchema,
  model: z.string().min(1).max(100),
  temperature: z.number().min(0).max(2).default(0.7),
  webhookUrl: z.url().nullish(),
  systemPrompt: z.string().min(1).max(50_000).optional(),
});
export type CreateAppInput = z.infer<typeof createAppSchema>;

export const updateAppSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    emoji: z.string().min(1).max(8),
    status: z.enum(["live", "paused"]),
    provider: providerSchema,
    model: z.string().min(1).max(100),
    temperature: z.number().min(0).max(2),
    webhookUrl: z.url().nullable(),
    allowTestTokens: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");
export type UpdateAppInput = z.infer<typeof updateAppSchema>;

export const publishPromptSchema = z.object({
  content: z.string().min(1).max(50_000),
  note: z.string().max(200).optional(),
});
export type PublishPromptInput = z.infer<typeof publishPromptSchema>;

export const planLimitSchema = z.object({
  plan: z.string().trim().min(1).max(40),
  messagesPerDay: z.number().int().min(0).max(1_000_000),
  maxOutputTokens: z.number().int().min(1).max(200_000),
});
export type PlanLimitInput = z.infer<typeof planLimitSchema>;

export const replaceLimitsSchema = z.object({
  limits: z
    .array(planLimitSchema)
    .max(20)
    .refine((ls) => new Set(ls.map((l) => l.plan)).size === ls.length, "Plan names must be unique"),
});

export const setProviderKeySchema = z.object({ apiKey: z.string().trim().min(10).max(500) });

export const idParamSchema = z.object({ id: z.uuid() });
export const versionParamSchema = z.object({ id: z.uuid(), version: z.coerce.number().int().min(1) });
export const providerParamSchema = z.object({ provider: providerSchema });

export const logListQuerySchema = z.object({
  appId: z.uuid().optional(),
  status: z.enum(["ok", "error", "rate_limited", "aborted"]).optional(),
  tokenKind: z.enum(["live", "test", "playground"]).optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type LogListQuery = z.infer<typeof logListQuerySchema>;

const varsSchema = z.record(z.string().regex(/^\w+$/, "Variable names: letters, numbers, _"), z.string().max(20_000)).default({});

// Identity (app, user, plan) and trusted vars come from the bearer token.
// Body vars are untrusted client input; token vars win on conflict.
export const chatRequestSchema = z.object({
  vars: varsSchema,
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(100_000),
      }),
    )
    .min(1)
    .max(200)
    .refine((ms) => ms[ms.length - 1]!.role === "user", "The last message must be from the user"),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

export const createTestTokenSchema = z.object({
  label: z.string().trim().min(1).max(80),
  user: z.string().trim().min(1).max(200),
  plan: z.string().trim().min(1).max(40),
  vars: varsSchema,
  expiresIn: z.enum(["1h", "1d", "7d"]),
});
export type CreateTestTokenInput = z.infer<typeof createTestTokenSchema>;

export const playgroundTokenSchema = z.object({
  user: z.string().trim().min(1).max(200).default("playground"),
  plan: z.string().trim().min(1).max(40),
  vars: varsSchema,
});
export type PlaygroundTokenInput = z.infer<typeof playgroundTokenSchema>;

export const tokenParamSchema = z.object({ id: z.uuid(), tokenId: z.uuid() });

// Local dev seed: the same apps the dashboard mock uses. Safe to re-run;
// apps whose slug already exists are skipped.
//   pnpm --filter @repo/db db:seed
import { randomBytes } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import db, { pool } from "./index";
import {
  appSchema,
  planLimitSchema,
  promptVersionSchema,
  providerKeySchema,
  workspaceSchema,
  type NewAppRow,
} from "./schema";

type SeedApp = Omit<NewAppRow, "signingSecret" | "activePromptVersion" | "workspaceId"> & {
  prompts: { content: string; note: string }[];
  limits?: { plan: string; messagesPerDay: number; maxOutputTokens: number }[];
};

const DEFAULT_LIMITS = [
  { plan: "free", messagesPerDay: 10, maxOutputTokens: 600 },
  { plan: "pro", messagesPerDay: 200, maxOutputTokens: 2000 },
];

const APPS: SeedApp[] = [
  {
    name: "Luna Stories",
    slug: "luna-stories",
    emoji: "🌙",
    status: "live",
    provider: "anthropic",
    model: "claude-sonnet-5-5",
    temperature: 0.9,
    prompts: [
      { note: "Initial prompt", content: "You are a bedtime storyteller. Write short, calming stories for kids." },
      {
        note: "Shorter stories, gentler endings",
        content:
          "You are Luna, a warm bedtime storyteller for children aged 3–8.\n\n- Keep stories under 400 words.\n- Always end calmly, with the main character falling asleep.\n- Never include scary villains, violence, or peril.\n- Use the child's name ({{child_name}}) and favourite animal ({{favorite_animal}}) when provided.",
      },
    ],
    limits: [
      { plan: "free", messagesPerDay: 3, maxOutputTokens: 800 },
      { plan: "pro", messagesPerDay: 50, maxOutputTokens: 1500 },
    ],
  },
  {
    name: "Roast Bot",
    slug: "roast-bot",
    emoji: "🔥",
    status: "live",
    provider: "anthropic",
    model: "claude-haiku-5-5",
    temperature: 1,
    prompts: [
      {
        note: "Initial prompt",
        content:
          "You are Roast Bot. Deliver a playful, witty roast of the user based on what they tell you about themselves.\n\nRules:\n- Punch up, never down. No jokes about appearance, race, gender, religion, disability or weight.\n- 3–5 sentences max.\n- End with one genuine compliment.",
      },
    ],
  },
  {
    name: "Puff Logger",
    slug: "puff-logger",
    emoji: "💨",
    status: "live",
    provider: "anthropic",
    model: "claude-sonnet-5-5",
    temperature: 0.6,
    prompts: [
      {
        note: "Quit coach v1",
        content:
          "You are a supportive, non-judgmental quit-vaping coach. You can see the user's recent puff log summary in {{puff_summary}}.\n\nCelebrate progress, suggest one small concrete step, and never shame relapses.",
      },
    ],
  },
  {
    name: "LiftArc",
    slug: "liftarc",
    emoji: "🏋️",
    status: "paused",
    provider: "openai",
    model: "gpt-5-mini",
    temperature: 0.4,
    prompts: [
      {
        note: "Workout suggestions",
        content:
          "You are a strength coach. Given the user's last 5 workouts ({{recent_workouts}}), suggest today's session with sets, reps and target weights. Be concise and use a table.",
      },
    ],
  },
  {
    name: "PoolCare",
    slug: "poolcare",
    emoji: "🏊",
    status: "live",
    provider: "google",
    model: "gemini-3.8-flash",
    temperature: 0.3,
    prompts: [
      {
        note: "Water chemistry helper",
        content:
          "You are a pool maintenance expert. Given test strip readings ({{readings}}) and pool volume ({{volume_gallons}}), explain what is off and exactly how much of each chemical to add. Always include a safety note.",
      },
    ],
  },
];

const PROVIDER_ENV = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
} as const;

/** Seed data lives in the "Default workspace"; the first user to sign up becomes its owner. */
async function defaultWorkspaceId(): Promise<string> {
  const [existing] = await db.select({ id: workspaceSchema.id }).from(workspaceSchema).where(eq(workspaceSchema.slug, "default"));
  if (existing) return existing.id;
  const [created] = await db.insert(workspaceSchema).values({ name: "Default workspace", slug: "default" }).returning({ id: workspaceSchema.id });
  return created!.id;
}

async function seed() {
  const workspaceId = await defaultWorkspaceId();
  for (const { prompts, limits = DEFAULT_LIMITS, ...app } of APPS) {
    const [existing] = await db
      .select({ id: appSchema.id })
      .from(appSchema)
      .where(and(eq(appSchema.slug, app.slug), isNull(appSchema.deletedAt)))
      .limit(1);
    if (existing) {
      console.log(`skip  ${app.slug} (exists)`);
      continue;
    }

    await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(appSchema)
        .values({
          ...app,
          workspaceId,
          signingSecret: `rls_live_${randomBytes(16).toString("hex")}`,
          activePromptVersion: prompts.length,
        })
        .returning({ id: appSchema.id });
      await tx
        .insert(promptVersionSchema)
        .values(prompts.map((p, i) => ({ appId: row!.id, version: i + 1, ...p })));
      await tx.insert(planLimitSchema).values(limits.map((l) => ({ appId: row!.id, ...l })));
    });
    console.log(`added ${app.slug}`);
  }

  // Provider keys come from your shell env, never from this file.
  for (const [provider, envVar] of Object.entries(PROVIDER_ENV) as [keyof typeof PROVIDER_ENV, string][]) {
    const apiKey = process.env[envVar];
    if (!apiKey) continue;
    await db
      .insert(providerKeySchema)
      .values({ workspaceId, provider, apiKey })
      .onConflictDoUpdate({ target: [providerKeySchema.workspaceId, providerKeySchema.provider], set: { apiKey } });
    console.log(`key   ${provider} (from ${envVar})`);
  }
}

seed()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

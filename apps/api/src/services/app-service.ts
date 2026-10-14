import db, {
  appSchema,
  planLimitSchema,
  promptVersionSchema,
  type AppRow,
  type PlanLimitRow,
  type PromptVersionRow,
} from "@repo/db";
import type { AppDetailDTO, AppDTO, PlanLimitDTO, PromptVersionDTO } from "@repo/dto";
import { and, asc, desc, eq, isNull, max } from "drizzle-orm";

import { Conflict, NotFound } from "../lib/api-error";
import { generateSigningSecret, maskSecret, slugify } from "../lib/helpers";
import type { CreateAppInput, PlanLimitInput, PublishPromptInput, UpdateAppInput } from "../lib/validators";

function appToDTO(row: AppRow): AppDTO {
  const { signingSecret, deletedAt: _deletedAt, ...rest } = row;
  return {
    ...rest,
    signingSecretPreview: maskSecret(signingSecret),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function promptToDTO(row: PromptVersionRow): PromptVersionDTO {
  return { version: row.version, content: row.content, note: row.note, createdAt: row.createdAt.toISOString() };
}

function limitToDTO(row: PlanLimitRow): PlanLimitDTO {
  return { plan: row.plan, messagesPerDay: row.messagesPerDay, maxOutputTokens: row.maxOutputTokens };
}

/** Load a non-deleted app by ID or throw 404. */
export async function requireApp(appId: string): Promise<AppRow> {
  const [row] = await db
    .select()
    .from(appSchema)
    .where(and(eq(appSchema.id, appId), isNull(appSchema.deletedAt)))
    .limit(1);
  if (!row) throw NotFound("App not found");
  return row;
}

export async function findAppBySlug(slug: string): Promise<AppRow | undefined> {
  const [row] = await db
    .select()
    .from(appSchema)
    .where(and(eq(appSchema.slug, slug), isNull(appSchema.deletedAt)))
    .limit(1);
  return row;
}

export async function listApps(): Promise<AppDTO[]> {
  const rows = await db.select().from(appSchema).where(isNull(appSchema.deletedAt)).orderBy(asc(appSchema.createdAt));
  return rows.map(appToDTO);
}

export async function getApp(appId: string): Promise<AppDetailDTO> {
  const app = await requireApp(appId);
  const [prompts, limits] = await Promise.all([
    db
      .select()
      .from(promptVersionSchema)
      .where(eq(promptVersionSchema.appId, appId))
      .orderBy(desc(promptVersionSchema.version)),
    db.select().from(planLimitSchema).where(eq(planLimitSchema.appId, appId)).orderBy(asc(planLimitSchema.createdAt)),
  ]);
  return { ...appToDTO(app), prompts: prompts.map(promptToDTO), limits: limits.map(limitToDTO) };
}

export async function createApp(input: CreateAppInput): Promise<AppDetailDTO> {
  const slug = input.slug ?? slugify(input.name);
  if (await findAppBySlug(slug)) throw Conflict(`An app with slug "${slug}" already exists`);

  const appId = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(appSchema)
      .values({
        name: input.name,
        slug,
        emoji: input.emoji,
        provider: input.provider,
        model: input.model,
        temperature: input.temperature,
        webhookUrl: input.webhookUrl,
        signingSecret: generateSigningSecret(),
        activePromptVersion: 1,
      })
      .returning({ id: appSchema.id });
    await tx.insert(promptVersionSchema).values({
      appId: row!.id,
      version: 1,
      content: input.systemPrompt ?? `You are the assistant for ${input.name}.`,
      note: "Initial prompt",
    });
    await tx.insert(planLimitSchema).values([
      { appId: row!.id, plan: "free", messagesPerDay: 10, maxOutputTokens: 600 },
      { appId: row!.id, plan: "pro", messagesPerDay: 200, maxOutputTokens: 2000 },
    ]);
    return row!.id;
  });

  return getApp(appId);
}

export async function updateApp(appId: string, input: UpdateAppInput): Promise<AppDTO> {
  await requireApp(appId);
  const [row] = await db.update(appSchema).set(input).where(eq(appSchema.id, appId)).returning();
  return appToDTO(row!);
}

/** Soft delete; frees the slug for reuse (partial unique index). */
export async function deleteApp(appId: string): Promise<void> {
  await requireApp(appId);
  await db.update(appSchema).set({ deletedAt: new Date() }).where(eq(appSchema.id, appId));
}

/** Returns the full secret, unlike every other endpoint. Only the dashboard's "reveal"/"copy" should call this. */
export async function revealSigningSecret(appId: string): Promise<string> {
  return (await requireApp(appId)).signingSecret;
}

export async function rotateSigningSecret(appId: string): Promise<string> {
  await requireApp(appId);
  const signingSecret = generateSigningSecret();
  await db.update(appSchema).set({ signingSecret }).where(eq(appSchema.id, appId));
  return signingSecret;
}

/** Insert the next prompt version and make it live, atomically. */
export async function publishPrompt(appId: string, input: PublishPromptInput): Promise<PromptVersionDTO> {
  await requireApp(appId);
  return db.transaction(async (tx) => {
    // Lock the app row so two concurrent publishes can't pick the same version number.
    await tx.select({ id: appSchema.id }).from(appSchema).where(eq(appSchema.id, appId)).for("update");
    const [{ latest } = { latest: 0 }] = await tx
      .select({ latest: max(promptVersionSchema.version) })
      .from(promptVersionSchema)
      .where(eq(promptVersionSchema.appId, appId));
    const version = (latest ?? 0) + 1;
    const [row] = await tx
      .insert(promptVersionSchema)
      .values({ appId, version, content: input.content, note: input.note ?? "" })
      .returning();
    await tx.update(appSchema).set({ activePromptVersion: version }).where(eq(appSchema.id, appId));
    return promptToDTO(row!);
  });
}

/** Roll back (or forward) to an existing version. */
export async function activatePromptVersion(appId: string, version: number): Promise<void> {
  await requireApp(appId);
  const [exists] = await db
    .select({ id: promptVersionSchema.id })
    .from(promptVersionSchema)
    .where(and(eq(promptVersionSchema.appId, appId), eq(promptVersionSchema.version, version)))
    .limit(1);
  if (!exists) throw NotFound(`Prompt version ${version} not found`);
  await db.update(appSchema).set({ activePromptVersion: version }).where(eq(appSchema.id, appId));
}

export async function getActivePrompt(app: AppRow): Promise<PromptVersionRow | undefined> {
  const [row] = await db
    .select()
    .from(promptVersionSchema)
    .where(and(eq(promptVersionSchema.appId, app.id), eq(promptVersionSchema.version, app.activePromptVersion)))
    .limit(1);
  return row;
}

/** Replace the app's whole set of plan limits (the dashboard edits them as one table). */
export async function replaceLimits(appId: string, limits: PlanLimitInput[]): Promise<PlanLimitDTO[]> {
  await requireApp(appId);
  await db.transaction(async (tx) => {
    await tx.delete(planLimitSchema).where(eq(planLimitSchema.appId, appId));
    if (limits.length) await tx.insert(planLimitSchema).values(limits.map((l) => ({ appId, ...l })));
  });
  return limits;
}

export async function getPlanLimit(appId: string, plan: string): Promise<PlanLimitRow | undefined> {
  const [row] = await db
    .select()
    .from(planLimitSchema)
    .where(and(eq(planLimitSchema.appId, appId), eq(planLimitSchema.plan, plan)))
    .limit(1);
  return row;
}

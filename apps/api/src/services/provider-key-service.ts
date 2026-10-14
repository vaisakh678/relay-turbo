import db, { providerKeySchema, providerEnum } from "@repo/db";
import type { ProviderKeyDTO } from "@repo/dto";
import { and, eq } from "drizzle-orm";

import { NotFound } from "../lib/api-error";
import { maskSecret } from "../lib/helpers";

type Provider = (typeof providerEnum.enumValues)[number];

/** Every provider, configured or not, with keys masked. */
export async function listProviderKeys(workspaceId: string): Promise<ProviderKeyDTO[]> {
  const rows = await db.select().from(providerKeySchema).where(eq(providerKeySchema.workspaceId, workspaceId));
  return providerEnum.enumValues.map((provider) => {
    const row = rows.find((r) => r.provider === provider);
    return {
      provider,
      configured: !!row,
      preview: row ? maskSecret(row.apiKey) : null,
      updatedAt: row?.updatedAt.toISOString() ?? null,
    };
  });
}

export async function setProviderKey(workspaceId: string, provider: Provider, apiKey: string): Promise<ProviderKeyDTO> {
  const [row] = await db
    .insert(providerKeySchema)
    .values({ workspaceId, provider, apiKey })
    .onConflictDoUpdate({
      target: [providerKeySchema.workspaceId, providerKeySchema.provider],
      set: { apiKey, updatedAt: new Date() },
    })
    .returning();
  return { provider, configured: true, preview: maskSecret(row!.apiKey), updatedAt: row!.updatedAt.toISOString() };
}

export async function deleteProviderKey(workspaceId: string, provider: Provider): Promise<void> {
  const deleted = await db
    .delete(providerKeySchema)
    .where(and(eq(providerKeySchema.workspaceId, workspaceId), eq(providerKeySchema.provider, provider)))
    .returning();
  if (!deleted.length) throw NotFound(`No ${provider} key configured`);
}

/** Raw key for calling the provider. Server-side only; never return this from a route. */
export async function getProviderKey(workspaceId: string, provider: Provider): Promise<string | undefined> {
  const [row] = await db
    .select()
    .from(providerKeySchema)
    .where(and(eq(providerKeySchema.workspaceId, workspaceId), eq(providerKeySchema.provider, provider)))
    .limit(1);
  return row?.apiKey;
}

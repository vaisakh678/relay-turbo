import db, { appSchema, requestLogSchema, type NewRequestLogRow, type RequestLogRow } from "@repo/db";
import type { AppStatsDTO, LogDTO, LogPageDTO, TimeseriesPointDTO } from "@repo/dto";
import { and, count, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";

import type { LogListQuery } from "../lib/validators";


function logToDTO(row: RequestLogRow): LogDTO {
  const { costMicros, ...rest } = row;
  return { ...rest, cost: costMicros / 1_000_000, createdAt: row.createdAt.toISOString() };
}

export async function insertLog(log: NewRequestLogRow): Promise<void> {
  await db.insert(requestLogSchema).values(log);
}

/**
 * Newest first. IDs are UUIDv7 (time-ordered), so the cursor is simply the
 * last ID seen and "older than cursor" is `id < cursor`. `total` counts every
 * row matching the filters (ignoring the cursor) for "1–50 of 1,234".
 */
/** IDs of a workspace's apps (including deleted ones, so their history stays visible). */
const workspaceAppIds = (workspaceId: string) =>
  db.select({ id: appSchema.id }).from(appSchema).where(eq(appSchema.workspaceId, workspaceId));

export async function listLogs(workspaceId: string, query: LogListQuery): Promise<LogPageDTO> {
  const { appId, status, tokenKind, cursor, limit } = query;
  const filters = [
    inArray(requestLogSchema.appId, workspaceAppIds(workspaceId)),
    appId ? eq(requestLogSchema.appId, appId) : undefined,
    status ? eq(requestLogSchema.status, status) : undefined,
    tokenKind ? eq(requestLogSchema.tokenKind, tokenKind) : undefined,
  ].filter((c) => c !== undefined);
  const pageConditions = cursor ? [...filters, lt(requestLogSchema.id, cursor)] : filters;

  const [rows, [counted]] = await Promise.all([
    db
      .select()
      .from(requestLogSchema)
      .where(pageConditions.length ? and(...pageConditions) : undefined)
      .orderBy(desc(requestLogSchema.id))
      .limit(limit + 1),
    db
      .select({ n: count() })
      .from(requestLogSchema)
      .where(filters.length ? and(...filters) : undefined),
  ]);

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map(logToDTO);
  return { items, nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null, total: counted?.n ?? 0 };
}

/** Test-token requests for an app (all tokens combined) that count toward its daily test cap. */
export async function countTestRequestsSince(appId: string, since: Date): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(requestLogSchema)
    .where(
      and(
        eq(requestLogSchema.appId, appId),
        eq(requestLogSchema.tokenKind, "test"),
        gte(requestLogSchema.createdAt, since),
        inArray(requestLogSchema.status, ["ok", "aborted"]),
      ),
    );
  return row?.n ?? 0;
}

/**
 * Requests that count toward a user's daily limit: completed or cancelled
 * streams (both consumed tokens). Rejected and failed requests don't, so a
 * provider outage never eats a user's quota.
 */
export async function countRequestsSince(appId: string, externalUserId: string, since: Date): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(requestLogSchema)
    .where(
      and(
        eq(requestLogSchema.appId, appId),
        eq(requestLogSchema.externalUserId, externalUserId),
        gte(requestLogSchema.createdAt, since),
        inArray(requestLogSchema.status, ["ok", "aborted"]),
      ),
    );
  return row?.n ?? 0;
}

/** Per-app totals over the last `hours` hours, for the dashboard overview. */
export async function getStats(workspaceId: string, hours = 24): Promise<AppStatsDTO[]> {
  const since = new Date(Date.now() - hours * 3_600_000);
  const rows = await db
    .select({
      appId: appSchema.id,
      requests: sql<number>`count(${requestLogSchema.id})::int`,
      tokens: sql<number>`coalesce(sum(${requestLogSchema.inputTokens} + ${requestLogSchema.outputTokens}), 0)::bigint`,
      costMicros: sql<number>`coalesce(sum(${requestLogSchema.costMicros}), 0)::bigint`,
      errors: sql<number>`count(*) filter (where ${requestLogSchema.status} = 'error')::int`,
      p50TtftMs: sql<number | null>`percentile_cont(0.5) within group (order by ${requestLogSchema.ttftMs})`,
    })
    .from(appSchema)
    .leftJoin(
      requestLogSchema,
      // Live traffic only: test and Playground requests would skew real numbers.
      and(
        eq(requestLogSchema.appId, appSchema.id),
        gte(requestLogSchema.createdAt, since),
        eq(requestLogSchema.tokenKind, "live"),
      ),
    )
    .where(and(eq(appSchema.workspaceId, workspaceId), isNull(appSchema.deletedAt)))
    .groupBy(appSchema.id);

  return rows.map((r) => {
    const requests = Number(r.requests);
    return {
      appId: r.appId,
      requests,
      tokens: Number(r.tokens),
      cost: Number(r.costMicros) / 1_000_000,
      errorRate: requests ? Number(r.errors) / requests : 0,
      p50TtftMs: r.p50TtftMs === null ? null : Math.round(Number(r.p50TtftMs)),
    };
  });
}

/** Requests per hour per app over the last `hours` hours, oldest first, gaps filled with 0. */
export async function getTimeseries(workspaceId: string, hours = 24): Promise<TimeseriesPointDTO[]> {
  const now = new Date();
  const end = new Date(Math.floor(now.getTime() / 3_600_000) * 3_600_000);
  const start = new Date(end.getTime() - (hours - 1) * 3_600_000);

  const rows = await db
    .select({
      hour: sql<string>`date_trunc('hour', ${requestLogSchema.createdAt}, 'UTC')`,
      appId: requestLogSchema.appId,
      n: sql<number>`count(*)::int`,
    })
    .from(requestLogSchema)
    .where(
      and(
        inArray(requestLogSchema.appId, workspaceAppIds(workspaceId)),
        gte(requestLogSchema.createdAt, start),
        eq(requestLogSchema.tokenKind, "live"),
      ),
    )
    .groupBy(sql`1`, requestLogSchema.appId);

  const buckets = new Map<number, Record<string, number>>();
  for (let t = start.getTime(); t <= end.getTime(); t += 3_600_000) buckets.set(t, {});
  for (const r of rows) {
    const bucket = buckets.get(new Date(r.hour).getTime());
    if (bucket) bucket[r.appId] = Number(r.n);
  }
  return [...buckets].map(([t, byApp]) => ({ hour: new Date(t).toISOString(), byApp }));
}

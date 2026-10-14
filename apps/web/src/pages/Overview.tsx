import type { AppDTO, AppStatsDTO, TimeseriesPointDTO } from '@repo/dto'
import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useApps, useLogs, useStats, useTimeseries } from '../api/hooks'
import { Badge, Card, CardHeader, Empty, Loading, PageHeader, QueryError, Stat, StatusDot } from '../components/ui'
import { APP_COLORS } from '../lib/colors'
import { compact, ms, pct, timeAgo, usd } from '../lib/format'

const hourLabel = (iso: string) => `${String(new Date(iso).getHours()).padStart(2, '0')}:00`

function RequestsChart({ apps, series }: { apps: AppDTO[]; series: TimeseriesPointDTO[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const totals = series.map((s) => Object.values(s.byApp).reduce((a, b) => a + b, 0))
  const max = Math.max(...totals, 1)
  const colorOf = (appId: string) => APP_COLORS[Math.max(0, apps.findIndex((a) => a.id === appId)) % APP_COLORS.length]

  return (
    <Card>
      <CardHeader
        title="Requests"
        description="Live traffic, last 24 hours, stacked by app"
        actions={
          <div className="hidden flex-wrap justify-end gap-x-3 gap-y-1 sm:flex">
            {apps.map((a) => (
              <span key={a.id} className="flex items-center gap-1.5 text-xs text-muted">
                <span className="size-2 rounded-sm" style={{ background: colorOf(a.id) }} />
                {a.name}
              </span>
            ))}
          </div>
        }
      />
      <div className="px-5 pb-4 pt-6">
        {totals.every((t) => t === 0) ? (
          <div className="flex h-48 items-center justify-center text-sm text-faint">
            No live requests in the last 24 hours. Test and Playground traffic shows up in Logs.
          </div>
        ) : (
          <div className="relative flex h-48 items-end gap-[3px]" onMouseLeave={() => setHover(null)}>
            {series.map((s, i) => {
              const total = totals[i]!
              return (
                <div key={s.hour} className="relative flex h-full flex-1 cursor-default flex-col justify-end" onMouseEnter={() => setHover(i)}>
                  <div
                    className="flex flex-col-reverse overflow-hidden rounded-t-[3px] transition-opacity"
                    style={{ height: `${(total / max) * 100}%`, opacity: hover === null || hover === i ? 1 : 0.4 }}
                  >
                    {apps.map((a) => (
                      <div
                        key={a.id}
                        style={{ height: `${total ? ((s.byApp[a.id] ?? 0) / total) * 100 : 0}%`, background: colorOf(a.id) }}
                      />
                    ))}
                  </div>
                  {hover === i && (
                    <div
                      className="pointer-events-none absolute bottom-full z-10 mb-2 w-44 rounded-lg border border-line-strong bg-panel-2 p-2.5 text-xs shadow-xl"
                      style={i > series.length - 8 ? { right: 0 } : { left: 0 }}
                    >
                      <div className="mb-1.5 flex justify-between font-medium">
                        <span>{hourLabel(s.hour)}</span>
                        <span className="tabular-nums">{compact(total)}</span>
                      </div>
                      {apps
                        .filter((a) => s.byApp[a.id])
                        .map((a) => (
                          <div key={a.id} className="flex justify-between text-muted">
                            <span className="truncate">{a.name}</span>
                            <span className="tabular-nums">{compact(s.byApp[a.id]!)}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        <div className="mt-2 flex justify-between font-mono text-[10px] text-faint">
          {series
            .filter((_, i) => i % 6 === 0)
            .map((s) => (
              <span key={s.hour}>{hourLabel(s.hour)}</span>
            ))}
          <span>now</span>
        </div>
      </div>
    </Card>
  )
}

function NeedsAttention({ apps }: { apps: AppDTO[] }) {
  const errors = useLogs({ status: 'error' }, 6)
  const limited = useLogs({ status: 'rate_limited' }, 6)
  const items = [...(errors.data?.pages[0]?.items ?? []), ...(limited.data?.pages[0]?.items ?? [])]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6)

  return (
    <Card className="lg:col-span-2">
      <CardHeader
        title="Needs attention"
        actions={
          <Link to="/logs" className="flex items-center gap-1 text-xs text-muted hover:text-fg">
            Logs <ArrowRight className="size-3" />
          </Link>
        }
      />
      {errors.isPending || limited.isPending ? (
        <Loading />
      ) : items.length === 0 ? (
        <Empty>No errors or rate limits. 🎉</Empty>
      ) : (
        <ul>
          {items.map((l) => {
            const app = apps.find((a) => a.id === l.appId)
            return (
              <li key={l.id} className="flex items-center gap-3 border-t border-line px-5 py-3 text-sm first:border-t-0">
                <Badge tone={l.status === 'error' ? 'danger' : 'warn'}>{l.status === 'error' ? 'error' : 'limited'}</Badge>
                <span className="min-w-0 flex-1 truncate text-muted">
                  {app?.name ?? 'Deleted app'} · <span className="font-mono text-xs">{l.externalUserId}</span>
                </span>
                <span className="text-xs text-faint">{timeAgo(l.createdAt)}</span>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

export function Overview() {
  const apps = useApps()
  const stats = useStats(24)
  const series = useTimeseries(24)

  if (apps.isPending || stats.isPending) return <Loading />
  if (apps.isError || stats.isError) {
    return (
      <QueryError
        error={apps.error ?? stats.error}
        onRetry={() => {
          void apps.refetch()
          void stats.refetch()
        }}
      />
    )
  }

  const statsOf = (id: string): AppStatsDTO | undefined => stats.data.find((s) => s.appId === id)
  const totals = stats.data.reduce(
    (acc, s) => ({ requests: acc.requests + s.requests, tokens: acc.tokens + s.tokens, cost: acc.cost + s.cost }),
    { requests: 0, tokens: 0, cost: 0 },
  )
  const ttfts = stats.data.flatMap((s) => (s.p50TtftMs === null ? [] : [s.p50TtftMs]))
  const p50 = ttfts.length ? ttfts.reduce((a, b) => a + b, 0) / ttfts.length : null

  return (
    <>
      <PageHeader title="Overview" description="Live traffic across your apps. Test and Playground requests are excluded." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Requests · 24h" value={compact(totals.requests)} sub={`${apps.data.filter((a) => a.status === 'live').length} live apps`} />
        <Stat label="Tokens · 24h" value={compact(totals.tokens)} sub="input + output" />
        <Stat label="Spend · 24h" value={usd(totals.cost)} sub={`≈ ${usd(totals.cost * 30)} / month`} />
        <Stat label="Time to first token" value={p50 === null ? '–' : ms(p50)} sub="p50 across apps" />
      </div>

      <div className="mt-6">
        {series.isPending ? <Card><Loading /></Card> : series.isError ? <Card><QueryError error={series.error} /></Card> : <RequestsChart apps={apps.data} series={series.data} />}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title="Apps"
            actions={
              <Link to="/apps" className="flex items-center gap-1 text-xs text-muted hover:text-fg">
                All apps <ArrowRight className="size-3" />
              </Link>
            }
          />
          {apps.data.length === 0 ? (
            <Empty>
              No apps yet. <Link to="/apps" className="text-fg underline underline-offset-2">Create one</Link>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-faint">
                    <th className="px-5 py-2.5 font-normal">App</th>
                    <th className="px-3 py-2.5 text-right font-normal">Requests</th>
                    <th className="px-3 py-2.5 text-right font-normal">Spend</th>
                    <th className="px-5 py-2.5 text-right font-normal">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {apps.data.map((a) => {
                    const s = statsOf(a.id)
                    return (
                      <tr key={a.id} className="border-t border-line hover:bg-panel-2/50">
                        <td className="px-5 py-3">
                          <Link to={`/apps/${a.id}`} className="flex items-center gap-2.5">
                            <StatusDot live={a.status === 'live'} />
                            <span className="text-base leading-none">{a.emoji}</span>
                            <span className="font-medium">{a.name}</span>
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-muted">{compact(s?.requests ?? 0)}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-muted">{usd(s?.cost ?? 0)}</td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          <span className={(s?.errorRate ?? 0) > 0.01 ? 'text-warn' : 'text-muted'}>{pct(s?.errorRate ?? 0)}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <NeedsAttention apps={apps.data} />
      </div>
    </>
  )
}

import { ArrowRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Badge, Card, CardHeader, PageHeader, Stat, StatusDot } from '../components/ui'
import { hourlySeries } from '../data/mock'
import { useStore } from '../data/store'
import { APP_COLORS } from '../lib/colors'
import { compact, ms, pct, timeAgo, usd } from '../lib/format'

function RequestsChart() {
  const { apps } = useStore()
  const series = useMemo(() => hourlySeries(apps), [apps])
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(...series.map((s) => Object.values(s.byApp).reduce((a, b) => a + b, 0)), 1)

  return (
    <Card>
      <CardHeader
        title="Requests"
        description="Last 24 hours, stacked by app"
        actions={
          <div className="hidden flex-wrap justify-end gap-x-3 gap-y-1 sm:flex">
            {apps.map((a, i) => (
              <span key={a.id} className="flex items-center gap-1.5 text-xs text-muted">
                <span className="size-2 rounded-sm" style={{ background: APP_COLORS[i % APP_COLORS.length] }} />
                {a.name}
              </span>
            ))}
          </div>
        }
      />
      <div className="px-5 pb-4 pt-6">
        <div className="relative flex h-48 items-end gap-[3px]" onMouseLeave={() => setHover(null)}>
          {series.map((s, i) => {
            const total = Object.values(s.byApp).reduce((a, b) => a + b, 0)
            return (
              <div
                key={i}
                className="relative flex h-full flex-1 cursor-default flex-col justify-end"
                onMouseEnter={() => setHover(i)}
              >
                <div
                  className="flex flex-col-reverse overflow-hidden rounded-t-[3px] transition-opacity"
                  style={{ height: `${(total / max) * 100}%`, opacity: hover === null || hover === i ? 1 : 0.4 }}
                >
                  {apps.map((a, ai) => (
                    <div
                      key={a.id}
                      style={{
                        height: `${total ? ((s.byApp[a.id] ?? 0) / total) * 100 : 0}%`,
                        background: APP_COLORS[ai % APP_COLORS.length],
                      }}
                    />
                  ))}
                </div>
                {hover === i && (
                  <div
                    className="pointer-events-none absolute bottom-full z-10 mb-2 w-44 rounded-lg border border-line-strong bg-panel-2 p-2.5 text-xs shadow-xl"
                    style={i > 16 ? { right: 0 } : { left: 0 }}
                  >
                    <div className="mb-1.5 flex justify-between font-medium">
                      <span>{String(s.hour).padStart(2, '0')}:00</span>
                      <span className="tabular-nums">{compact(total)}</span>
                    </div>
                    {apps
                      .filter((a) => s.byApp[a.id])
                      .map((a) => (
                        <div key={a.id} className="flex justify-between text-muted">
                          <span className="truncate">{a.name}</span>
                          <span className="tabular-nums">{compact(s.byApp[a.id])}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div className="mt-2 flex justify-between font-mono text-[10px] text-faint">
          {series
            .filter((_, i) => i % 6 === 0)
            .map((s, i) => (
              <span key={i}>{String(s.hour).padStart(2, '0')}:00</span>
            ))}
          <span>now</span>
        </div>
      </div>
    </Card>
  )
}

export function Overview() {
  const { apps, logs } = useStore()
  const totals = apps.reduce(
    (acc, a) => ({
      requests: acc.requests + a.stats.requests24h,
      tokens: acc.tokens + a.stats.tokens24h,
      cost: acc.cost + a.stats.cost24h,
    }),
    { requests: 0, tokens: 0, cost: 0 },
  )
  const liveApps = apps.filter((a) => a.status === 'live' && a.stats.requests24h > 0)
  const p50 = liveApps.length ? liveApps.reduce((a, b) => a + b.stats.p50LatencyMs, 0) / liveApps.length : 0
  const problems = logs.filter((l) => l.status === 'error' || l.status === 'rate_limited').slice(0, 6)

  return (
    <>
      <PageHeader title="Overview" description="Every AI stream across your apps, in one place." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Requests · 24h" value={compact(totals.requests)} sub={`${apps.filter((a) => a.status === 'live').length} live apps`} />
        <Stat label="Tokens · 24h" value={compact(totals.tokens)} sub="input + output" />
        <Stat label="Spend · 24h" value={usd(totals.cost)} sub={`≈ ${usd(totals.cost * 30)} / month`} />
        <Stat label="Time to first token" value={ms(p50)} sub="p50 across apps" />
      </div>

      <div className="mt-6">
        <RequestsChart />
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
                {apps.map((a) => (
                  <tr key={a.id} className="border-t border-line hover:bg-panel-2/50">
                    <td className="px-5 py-3">
                      <Link to={`/apps/${a.id}`} className="flex items-center gap-2.5">
                        <StatusDot live={a.status === 'live'} />
                        <span className="text-base leading-none">{a.emoji}</span>
                        <span className="font-medium">{a.name}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted">{compact(a.stats.requests24h)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted">{usd(a.stats.cost24h)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      <span className={a.stats.errorRate > 0.01 ? 'text-warn' : 'text-muted'}>{pct(a.stats.errorRate)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Needs attention"
            actions={
              <Link to="/logs" className="flex items-center gap-1 text-xs text-muted hover:text-fg">
                Logs <ArrowRight className="size-3" />
              </Link>
            }
          />
          <ul>
            {problems.map((l) => {
              const app = apps.find((a) => a.id === l.appId)
              return (
                <li key={l.id} className="flex items-center gap-3 border-t border-line px-5 py-3 first:border-t-0 text-sm">
                  <Badge tone={l.status === 'error' ? 'danger' : 'warn'}>{l.status === 'error' ? 'error' : 'limited'}</Badge>
                  <span className="min-w-0 flex-1 truncate text-muted">
                    {app?.name} · <span className="font-mono text-xs">{l.userId}</span>
                  </span>
                  <span className="text-xs text-faint">{timeAgo(l.at)}</span>
                </li>
              )
            })}
          </ul>
        </Card>
      </div>
    </>
  )
}

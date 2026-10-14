import type { AppDTO, LogDTO, RequestStatus, TokenKind } from '@repo/dto'
import { X } from 'lucide-react'
import { useState } from 'react'
import { useApps, useLogs } from '../api/hooks'
import { Badge, Button, Card, Empty, Loading, PageHeader, QueryError, Select } from '../components/ui'
import { cn } from '../lib/cn'
import { ms, timeAgo, usd } from '../lib/format'

const statusTone: Record<RequestStatus, 'success' | 'danger' | 'warn' | 'neutral'> = {
  ok: 'success',
  error: 'danger',
  rate_limited: 'warn',
  aborted: 'neutral',
}

function Detail({ log, app, onClose }: { log: LogDTO; app?: AppDTO; onClose: () => void }) {
  const rows: [string, string][] = [
    ['Request', log.id],
    ['App', app ? `${app.emoji} ${app.name}` : 'Deleted app'],
    ['User', log.externalUserId],
    ['Plan', log.plan],
    ['Token', log.tokenKind],
    ['Model', log.model],
    ['Prompt', `v${log.promptVersion}`],
    ['Input tokens', String(log.inputTokens)],
    ['Output tokens', String(log.outputTokens)],
    ['Time to first token', log.ttftMs === null ? '–' : ms(log.ttftMs)],
    ['Duration', ms(log.durationMs)],
    ['Cost', usd(log.cost)],
    ['Time', new Date(log.createdAt).toLocaleString()],
  ]
  return (
    <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose}>
      <aside
        className="absolute inset-y-0 right-0 w-full max-w-sm overflow-y-auto border-l border-line-strong bg-panel p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <Badge tone={statusTone[log.status]}>{log.status.replace('_', ' ')}</Badge>
          <button onClick={onClose} className="rounded-md p-1 text-muted hover:bg-panel-2 hover:text-fg" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <dl className="mt-5 divide-y divide-line text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2.5">
              <dt className="text-muted">{k}</dt>
              <dd className="truncate font-mono text-xs leading-5">{v}</dd>
            </div>
          ))}
        </dl>
        {log.error && (
          <pre className="mt-4 whitespace-pre-wrap rounded-lg border border-danger/30 bg-danger/5 p-3 font-mono text-[11px] text-danger">
            {log.error}
          </pre>
        )}
        {log.status === 'rate_limited' && (
          <pre className="mt-4 whitespace-pre-wrap rounded-lg border border-warn/30 bg-warn/5 p-3 font-mono text-[11px] text-warn">
            429 daily message limit reached for plan "{log.plan}"
          </pre>
        )}
      </aside>
    </div>
  )
}

export function Logs() {
  const apps = useApps()
  const [appId, setAppId] = useState('')
  const [status, setStatus] = useState<'' | RequestStatus>('')
  const [tokenKind, setTokenKind] = useState<'' | TokenKind>('')
  const [selected, setSelected] = useState<LogDTO | null>(null)
  const logs = useLogs({ appId: appId || undefined, status: status || undefined, tokenKind: tokenKind || undefined })
  const items = logs.data?.pages.flatMap((p) => p.items) ?? []
  const appOf = (id: string) => apps.data?.find((a) => a.id === id)

  return (
    <>
      <PageHeader title="Logs" description="Every stream that went through Relay. Message content is never stored." />

      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={appId} onChange={(e) => setAppId(e.target.value)} className="w-44">
          <option value="">All apps</option>
          {apps.data?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.emoji} {a.name}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value as '' | RequestStatus)} className="w-40">
          <option value="">All statuses</option>
          <option value="ok">ok</option>
          <option value="error">error</option>
          <option value="rate_limited">rate limited</option>
          <option value="aborted">aborted</option>
        </Select>
        <Select value={tokenKind} onChange={(e) => setTokenKind(e.target.value as '' | TokenKind)} className="w-40">
          <option value="">All traffic</option>
          <option value="live">Live</option>
          <option value="test">Test tokens</option>
          <option value="playground">Playground</option>
        </Select>
        <Button variant="ghost" onClick={() => logs.refetch()} disabled={logs.isFetching}>
          {logs.isFetching ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      <Card className="overflow-hidden">
        {logs.isPending ? (
          <Loading />
        ) : logs.isError ? (
          <QueryError error={logs.error} onRetry={() => logs.refetch()} />
        ) : items.length === 0 ? (
          <Empty>No requests yet{appId || status || tokenKind ? ' for these filters' : ''}. Send one from the Playground.</Empty>
        ) : (
          <div className={cn('overflow-x-auto transition-opacity', logs.isPlaceholderData && 'opacity-50')}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-faint">
                  <th className="px-5 py-2.5 font-normal">Status</th>
                  <th className="px-3 py-2.5 font-normal">App</th>
                  <th className="px-3 py-2.5 font-normal">User</th>
                  <th className="hidden px-3 py-2.5 font-normal md:table-cell">Model</th>
                  <th className="px-3 py-2.5 text-right font-normal">Tokens</th>
                  <th className="hidden px-3 py-2.5 text-right font-normal sm:table-cell">TTFT</th>
                  <th className="px-3 py-2.5 text-right font-normal">Cost</th>
                  <th className="px-5 py-2.5 text-right font-normal">Time</th>
                </tr>
              </thead>
              <tbody>
                {items.map((l) => {
                  const app = appOf(l.appId)
                  return (
                    <tr
                      key={l.id}
                      onClick={() => setSelected(l)}
                      className={cn('cursor-pointer border-t border-line hover:bg-panel-2/50', selected?.id === l.id && 'bg-panel-2/50')}
                    >
                      <td className="px-5 py-2.5">
                        <Badge tone={statusTone[l.status]}>{l.status.replace('_', ' ')}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">{app ? `${app.emoji} ${app.name}` : '–'}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-muted">
                        {l.externalUserId} <span className="text-faint">· {l.plan}</span>
                        {l.tokenKind !== 'live' && (
                          <span className="ml-2 align-middle">
                            <Badge tone="info">{l.tokenKind}</Badge>
                          </span>
                        )}
                      </td>
                      <td className="hidden px-3 py-2.5 font-mono text-xs text-muted md:table-cell">{l.model}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted">{(l.inputTokens + l.outputTokens).toLocaleString()}</td>
                      <td className="hidden px-3 py-2.5 text-right tabular-nums text-muted sm:table-cell">{l.ttftMs === null ? '–' : ms(l.ttftMs)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted">{usd(l.cost)}</td>
                      <td className="whitespace-nowrap px-5 py-2.5 text-right text-xs text-faint">{timeAgo(l.createdAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {logs.hasNextPage && (
          <div className="border-t border-line p-3 text-center">
            <Button size="sm" onClick={() => logs.fetchNextPage()} disabled={logs.isFetchingNextPage}>
              {logs.isFetchingNextPage ? 'Loading…' : 'Load more'}
            </Button>
          </div>
        )}
      </Card>

      {selected && <Detail log={selected} app={appOf(selected.appId)} onClose={() => setSelected(null)} />}
    </>
  )
}

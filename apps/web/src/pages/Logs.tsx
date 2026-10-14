import { X } from 'lucide-react'
import { useState } from 'react'
import { Badge, Card, Empty, PageHeader, Select } from '../components/ui'
import { useStore } from '../data/store'
import type { LogEntry, LogStatus } from '../data/types'
import { cn } from '../lib/cn'
import { ms, timeAgo, usd } from '../lib/format'

const statusTone: Record<LogStatus, 'success' | 'danger' | 'warn' | 'neutral'> = {
  ok: 'success',
  error: 'danger',
  rate_limited: 'warn',
  aborted: 'neutral',
}

function Detail({ log, onClose }: { log: LogEntry; onClose: () => void }) {
  const { apps } = useStore()
  const app = apps.find((a) => a.id === log.appId)
  const rows: [string, string][] = [
    ['Request', log.id],
    ['App', `${app?.emoji} ${app?.name}`],
    ['User', log.userId],
    ['Plan', log.plan],
    ['Model', log.model],
    ['Prompt', `v${log.promptVersion}`],
    ['Input tokens', String(log.inputTokens)],
    ['Output tokens', String(log.outputTokens)],
    ['Time to first token', log.ttftMs ? ms(log.ttftMs) : '–'],
    ['Duration', ms(log.durationMs)],
    ['Cost', usd(log.cost)],
    ['Time', new Date(log.at).toLocaleString()],
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
        {log.status === 'error' && (
          <pre className="mt-4 whitespace-pre-wrap rounded-lg border border-danger/30 bg-danger/5 p-3 font-mono text-[11px] text-danger">
            upstream 529 overloaded_error: provider is temporarily overloaded
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
  const { apps, logs } = useStore()
  const [appId, setAppId] = useState('all')
  const [status, setStatus] = useState<'all' | LogStatus>('all')
  const [selected, setSelected] = useState<LogEntry | null>(null)

  const filtered = logs.filter((l) => (appId === 'all' || l.appId === appId) && (status === 'all' || l.status === status))

  return (
    <>
      <PageHeader title="Logs" description="Every stream that went through Relay. Message content is never stored." />

      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={appId} onChange={(e) => setAppId(e.target.value)} className="w-44">
          <option value="all">All apps</option>
          {apps.map((a) => (
            <option key={a.id} value={a.id}>
              {a.emoji} {a.name}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value as 'all' | LogStatus)} className="w-40">
          <option value="all">All statuses</option>
          <option value="ok">ok</option>
          <option value="error">error</option>
          <option value="rate_limited">rate limited</option>
          <option value="aborted">aborted</option>
        </Select>
        <span className="ml-auto self-center text-xs text-faint">{filtered.length} requests</span>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
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
              {filtered.map((l) => {
                const app = apps.find((a) => a.id === l.appId)
                return (
                  <tr
                    key={l.id}
                    onClick={() => setSelected(l)}
                    className={cn('cursor-pointer border-t border-line hover:bg-panel-2/50', selected?.id === l.id && 'bg-panel-2/50')}
                  >
                    <td className="px-5 py-2.5">
                      <Badge tone={statusTone[l.status]}>{l.status.replace('_', ' ')}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      {app?.emoji} {app?.name}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-muted">
                      {l.userId} <span className="text-faint">· {l.plan}</span>
                    </td>
                    <td className="hidden px-3 py-2.5 font-mono text-xs text-muted md:table-cell">{l.model}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted">{(l.inputTokens + l.outputTokens).toLocaleString()}</td>
                    <td className="hidden px-3 py-2.5 text-right tabular-nums text-muted sm:table-cell">{l.ttftMs ? ms(l.ttftMs) : '–'}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted">{usd(l.cost)}</td>
                    <td className="whitespace-nowrap px-5 py-2.5 text-right text-xs text-faint">{timeAgo(l.at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <Empty>No requests match these filters.</Empty>}
      </Card>

      {selected && <Detail log={selected} onClose={() => setSelected(null)} />}
    </>
  )
}

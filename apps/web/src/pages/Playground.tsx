import type { AppDetailDTO } from '@repo/dto'
import { AbortError, createRelay, RateLimitError, type RelayStream } from '@sse-relay/sdk'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowUp, Square, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { API_ORIGIN } from '../api/client'
import { fetchPlaygroundToken, useApp, useApps } from '../api/hooks'
import { Badge, Button, Card, CardHeader, Field, Input, Loading, PageHeader, QueryError, Select, Textarea } from '../components/ui'
import { cn } from '../lib/cn'
import { ms } from '../lib/format'

type Message = { role: 'user' | 'assistant'; content: string; error?: boolean }
type Metrics = { ttft: number | null; duration: number; tokens: number }
type LogLine = { t: number; line: string; kind: 'meta' | 'delta' | 'error' }

// Stable per-browser test user, so daily limits behave like a real user's
const PLAYGROUND_USER = 'playground'

function useAutoScroll(dep: unknown) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight })
  }, [dep])
  return ref
}

function Chat({ app }: { app: AppDetailDTO }) {
  const qc = useQueryClient()
  const [plan, setPlan] = useState(app.limits[0]?.plan ?? 'free')
  const [vars, setVars] = useState<Record<string, string>>({})
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [events, setEvents] = useState<LogLine[]>([])
  const streamRef = useRef<RelayStream | null>(null)
  const chatRef = useAutoScroll(messages)
  const eventsRef = useAutoScroll(events)

  const prompt = app.prompts.find((p) => p.version === app.activePromptVersion)?.content ?? ''
  const varNames = [...new Set([...prompt.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]!))]
  const limit = app.limits.find((l) => l.plan === plan)

  const appendToReply = (patch: (m: Message) => Message) =>
    setMessages((ms) => [...ms.slice(0, -1), patch(ms[ms.length - 1]!)])

  const filledVars = useMemo(() => Object.fromEntries(Object.entries(vars).filter(([, v]) => v)), [vars])
  const startRef = useRef(0)
  const log = (line: string, kind: LogLine['kind'] = 'meta') =>
    setEvents((e) => [...e.slice(-300), { t: performance.now() - startRef.current, line, kind }])

  // Plan and vars are baked into the token, so a change means a new client (and a new token).
  // The SDK caches the token until shortly before expiry and refreshes it on a 401.
  const relay = useMemo(
    () =>
      createRelay({
        baseUrl: API_ORIGIN,
        token: async () => {
          const { token, expiresAt } = await fetchPlaygroundToken(app.id, { user: PLAYGROUND_USER, plan, vars: filledVars })
          log(`↻ minted playground token (expires ${new Date(expiresAt).toLocaleTimeString()})`)
          return token
        },
      }),
    [app.id, plan, filledVars],
  )

  async function send() {
    const text = input.trim()
    if (!text || streaming) return
    const history = [...messages.filter((m) => !m.error), { role: 'user' as const, content: text }]
    setInput('')
    setMessages([...messages, { role: 'user', content: text }, { role: 'assistant', content: '' }])
    setStreaming(true)
    setMetrics(null)

    startRef.current = performance.now()
    let ttft: number | null = null
    let tokens = 0
    log(`→ POST /chat  app=${app.slug} plan=${plan}`)

    const stream = relay.stream({ messages: history.map(({ role, content }) => ({ role, content })) })
    streamRef.current = stream
    try {
      for await (const e of stream) {
        if (e.type === 'delta') {
          ttft ??= performance.now() - startRef.current
          appendToReply((m) => ({ ...m, content: m.content + e.text }))
          log(`delta  ${JSON.stringify(e.text)}`, 'delta')
        } else {
          if (e.type === 'done' && e.finishReason === 'length') {
            // Hit the plan's max output tokens; with reasoning models this can happen before any text
            appendToReply((m) =>
              m.content
                ? { ...m, content: `${m.content}\n\n[cut off: reached the plan's ${limit?.maxOutputTokens ?? ''} max output tokens]` }
                : { ...m, error: true, content: `No text: the model used all ${tokens || limit?.maxOutputTokens} output tokens before answering. Raise this plan's max output tokens.` },
            )
          }
          if (e.type === 'usage') tokens = e.usage.output
          const { type, ...data } = e
          log(`${type}  ${JSON.stringify(data)}`)
        }
      }
    } catch (err) {
      if (err instanceof AbortError) {
        log('✕ aborted by client')
      } else {
        const message =
          err instanceof RateLimitError && err.resetAt
            ? `${err.message} (resets ${err.resetAt.toLocaleTimeString()})`
            : err instanceof Error
              ? err.message
              : String(err)
        log(`✕ ${err instanceof Error ? err.constructor.name : 'Error'}: ${message}`, 'error')
        appendToReply((m) => ({ ...m, content: m.content || message, error: !m.content }))
      }
    } finally {
      setMetrics({ ttft, duration: performance.now() - startRef.current, tokens })
      setStreaming(false)
      streamRef.current = null
      // The stream wrote a log row; refresh anything that shows logs/stats
      void qc.invalidateQueries({ queryKey: ['logs'] })
      void qc.invalidateQueries({ queryKey: ['stats'] })
      void qc.invalidateQueries({ queryKey: ['timeseries'] })
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
      <div className="space-y-4">
        <Card className="space-y-4 p-5">
          <Field label="Simulate plan" hint={limit && `${limit.messagesPerDay} msgs/day · ${limit.maxOutputTokens} max tokens`}>
            <Select value={plan} onChange={(e) => setPlan(e.target.value)}>
              {app.limits.map((l) => (
                <option key={l.plan}>{l.plan}</option>
              ))}
            </Select>
          </Field>
          {varNames.map((v) => (
            <Field key={v} label={`{{${v}}}`}>
              <Input value={vars[v] ?? ''} onChange={(e) => setVars({ ...vars, [v]: e.target.value })} className="font-mono text-xs" />
            </Field>
          ))}
          <p className="text-xs text-faint">
            Requests run as user <code className="font-mono">{PLAYGROUND_USER}</code> and count toward its daily limit.
          </p>
        </Card>
        <Card>
          <CardHeader title="System prompt" actions={<Badge tone="success">v{app.activePromptVersion}</Badge>} />
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap p-4 font-mono text-[11px] leading-relaxed text-muted">
            {prompt.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => vars[k] || m)}
          </pre>
        </Card>
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[1fr_20rem]">
        <Card className="flex h-[640px] flex-col">
          <div className="flex items-center gap-4 border-b border-line px-5 py-3 text-xs text-muted">
            <span className="font-mono">{app.model}</span>
            {metrics && (
              <>
                {metrics.ttft !== null && (
                  <span>
                    TTFT <span className="tabular-nums text-fg">{ms(metrics.ttft)}</span>
                  </span>
                )}
                {metrics.tokens > 0 && (
                  <span>
                    <span className="tabular-nums text-fg">{Math.round(metrics.tokens / (metrics.duration / 1000))}</span> tok/s
                  </span>
                )}
              </>
            )}
            <button
              onClick={() => {
                setMessages([])
                setEvents([])
                setMetrics(null)
              }}
              disabled={streaming}
              className="ml-auto rounded-md p-1 hover:bg-panel-2 hover:text-fg disabled:opacity-40"
              aria-label="Clear chat"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>

          <div ref={chatRef} className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="text-3xl">{app.emoji}</div>
                <p className="mt-3 text-sm text-muted">Send a message to start a real stream through {app.name}.</p>
                {app.status !== 'live' && <p className="mt-1 text-xs text-warn">This app is paused, so requests will be rejected.</p>}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={cn('flex', m.role === 'user' && 'justify-end')}>
                <div
                  className={cn(
                    'max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                    m.role === 'user' && 'bg-accent text-accent-fg',
                    m.role === 'assistant' && !m.error && 'border border-line bg-panel-2',
                    m.error && 'border border-danger/30 bg-danger/5 text-danger',
                  )}
                >
                  {m.content}
                  {streaming && i === messages.length - 1 && <span className="caret ml-0.5" />}
                </div>
              </div>
            ))}
          </div>

          <form
            className="border-t border-line p-3"
            onSubmit={(e) => {
              e.preventDefault()
              void send()
            }}
          >
            <div className="flex items-end gap-2 rounded-xl border border-line-strong bg-bg p-1.5 focus-within:border-accent/60">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void send()
                  }
                }}
                rows={1}
                placeholder="Message…"
                className="max-h-40 resize-none border-0 bg-transparent focus:ring-0"
              />
              {streaming ? (
                <Button type="button" onClick={() => streamRef.current?.abort()} className="size-9 shrink-0 px-0" aria-label="Stop">
                  <Square className="size-3.5 fill-current" />
                </Button>
              ) : (
                <Button type="submit" variant="primary" disabled={!input.trim()} className="size-9 shrink-0 px-0" aria-label="Send">
                  <ArrowUp className="size-4" />
                </Button>
              )}
            </div>
          </form>
        </Card>

        <Card className="flex h-[640px] flex-col">
          <CardHeader title="Stream events" description="Raw SSE from the gateway" />
          <div ref={eventsRef} className="flex-1 overflow-y-auto p-3 font-mono text-[11px] leading-5">
            {events.length === 0 && <div className="p-2 text-faint">Waiting for a stream…</div>}
            {events.map((e, i) => (
              <div key={i} className="flex gap-3">
                <span className="w-12 shrink-0 text-right tabular-nums text-faint">{Math.round(e.t)}</span>
                <span className={cn('truncate', e.kind === 'delta' ? 'text-muted' : e.kind === 'error' ? 'text-danger' : 'text-accent')}>
                  {e.line}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

export function Playground() {
  const apps = useApps()
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('app') ?? apps.data?.[0]?.id ?? ''
  const app = useApp(selectedId)

  return (
    <>
      <PageHeader
        title="Playground"
        description="Real streams through the gateway, with the app's live prompt and limits."
        actions={
          apps.data && apps.data.length > 0 ? (
            <Select value={selectedId} onChange={(e) => setParams({ app: e.target.value })} className="w-56">
              {apps.data.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.emoji} {a.name}
                </option>
              ))}
            </Select>
          ) : undefined
        }
      />
      {apps.isPending || (selectedId && app.isPending) ? (
        <Loading />
      ) : apps.isError ? (
        <QueryError error={apps.error} onRetry={() => apps.refetch()} />
      ) : apps.data.length === 0 ? (
        <Card className="px-5 py-12 text-center text-sm text-muted">
          No apps yet. <Link to="/apps" className="text-fg underline underline-offset-2">Create one</Link> to test it here.
        </Card>
      ) : app.isError ? (
        <QueryError error={app.error} onRetry={() => app.refetch()} />
      ) : (
        // Keyed by app: switching apps starts a fresh conversation
        app.data && <Chat key={app.data.id} app={app.data} />
      )}
    </>
  )
}

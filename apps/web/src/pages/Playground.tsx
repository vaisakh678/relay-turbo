import { ArrowUp, Square, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Badge, Button, Card, CardHeader, Field, Input, PageHeader, Select, Textarea } from '../components/ui'
import { useStore } from '../data/store'
import type { RelayApp } from '../data/types'
import { cn } from '../lib/cn'
import { ms } from '../lib/format'

type Message = { role: 'user' | 'assistant'; content: string }
type Metrics = { ttft: number; duration: number; tokens: number }
type SseEvent = { t: number; line: string }

// Canned replies until the gateway is wired up
const CANNED: Record<string, string> = {
  'luna-stories':
    "Once upon a time, in a meadow where the fireflies hummed lullabies, a little fox named Pip couldn't fall asleep. He counted the stars, one by one, until the moon leaned down and whispered, \"Close your eyes, and I'll keep counting for you.\" Pip curled his tail around his nose, and as the moon counted softly, he drifted off into the sweetest dream. The end. 🌙",
  'roast-bot':
    "You told me you have 14 unfinished side projects, which honestly makes you less of a developer and more of a startup graveyard tour guide. Your GitHub contribution graph looks like a barcode for 'potential'. But hey, at least you start things, and that's more than most people can say.",
  'puff-logger':
    "Three days with fewer than 10 puffs is real progress, and that's worth celebrating. 🎉 For today, try one small step: when the first craving hits after lunch, take a 5-minute walk before deciding. Cravings usually peak and fade within that window.",
}

function fallback(app: RelayApp, input: string) {
  return `This is a simulated stream from **${app.model}** for ${app.name}. Once the gateway is running, Relay will send your system prompt (v${app.activeVersion}) plus "${input.slice(0, 60)}" to ${app.provider} and stream the tokens back to you here.`
}

function useAutoScroll(dep: unknown) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight })
  }, [dep])
  return ref
}

export function Playground() {
  const { apps } = useStore()
  const [params, setParams] = useSearchParams()
  const app = apps.find((a) => a.id === params.get('app')) ?? apps[0]
  const [plan, setPlan] = useState(app.limits[0]?.plan ?? 'free')
  const [vars, setVars] = useState<Record<string, string>>({})
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [events, setEvents] = useState<SseEvent[]>([])
  const stopRef = useRef(false)
  const chatRef = useAutoScroll(messages)
  const eventsRef = useAutoScroll(events)

  const prompt = app.prompts.find((p) => p.version === app.activeVersion)?.content ?? ''
  const varNames = [...new Set([...prompt.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]))]
  const limit = app.limits.find((l) => l.plan === plan)

  async function send() {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', content: text }, { role: 'assistant', content: '' }])
    setStreaming(true)
    stopRef.current = false

    const start = performance.now()
    const log = (line: string) => setEvents((e) => [...e.slice(-200), { t: performance.now() - start, line }])
    log(`→ POST /v1/chat  app=${app.slug} plan=${plan}`)

    const reply = CANNED[app.slug] ?? fallback(app, text)
    const chunks = reply.match(/\S+\s*/g) ?? []
    await new Promise((r) => setTimeout(r, 250 + Math.random() * 300))
    const ttft = performance.now() - start
    log('event: start')

    let count = 0
    for (const chunk of chunks) {
      if (stopRef.current) break
      count++
      setMessages((m) => {
        const next = [...m]
        next[next.length - 1] = { role: 'assistant', content: next[next.length - 1].content + chunk }
        return next
      })
      log(`event: delta  ${JSON.stringify(chunk)}`)
      await new Promise((r) => setTimeout(r, 20 + Math.random() * 40))
    }
    const outTokens = Math.round(count * 1.3)
    log(`event: usage  {"input":${Math.ceil(prompt.length / 4) + Math.ceil(text.length / 4)},"output":${outTokens}}`)
    log(stopRef.current ? 'event: aborted' : 'event: done')
    setMetrics({ ttft, duration: performance.now() - start, tokens: outTokens })
    setStreaming(false)
  }

  return (
    <>
      <PageHeader title="Playground" description="Test an app's live prompt and limits exactly as your users will hit them." />

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <div className="space-y-4">
          <Card className="space-y-4 p-5">
            <Field label="App">
              <Select
                value={app.id}
                onChange={(e) => {
                  setParams({ app: e.target.value })
                  setPlan(apps.find((a) => a.id === e.target.value)?.limits[0]?.plan ?? 'free')
                  setMessages([])
                  setEvents([])
                  setMetrics(null)
                  setVars({})
                }}
              >
                {apps.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.emoji} {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Simulate plan"
              hint={limit && `${limit.messagesPerDay} msgs/day · ${limit.maxOutputTokens} max tokens`}
            >
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
          </Card>
          <Card>
            <CardHeader title="System prompt" actions={<Badge tone="success">v{app.activeVersion}</Badge>} />
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap p-4 font-mono text-[11px] leading-relaxed text-muted">
              {prompt.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => vars[k] || m)}
            </pre>
          </Card>
        </div>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[1fr_20rem]">
          <Card className="flex h-[640px] flex-col">
            <div className="flex items-center gap-4 border-b border-line px-5 py-3 text-xs text-muted">
              <span className="font-mono">{app.model}</span>
              {metrics && (
                <>
                  <span>TTFT <span className="tabular-nums text-fg">{ms(metrics.ttft)}</span></span>
                  <span>
                    <span className="tabular-nums text-fg">{Math.round(metrics.tokens / (metrics.duration / 1000))}</span> tok/s
                  </span>
                </>
              )}
              <button
                onClick={() => {
                  setMessages([])
                  setEvents([])
                  setMetrics(null)
                }}
                className="ml-auto rounded-md p-1 hover:bg-panel-2 hover:text-fg"
                aria-label="Clear chat"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>

            <div ref={chatRef} className="flex-1 space-y-4 overflow-y-auto p-5">
              {messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="text-3xl">{app.emoji}</div>
                  <p className="mt-3 text-sm text-muted">Send a message to start a stream through {app.name}.</p>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={cn('flex', m.role === 'user' && 'justify-end')}>
                  <div
                    className={cn(
                      'max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                      m.role === 'user' ? 'bg-accent text-accent-fg' : 'border border-line bg-panel-2',
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
                send()
              }}
            >
              <div className="flex items-end gap-2 rounded-xl border border-line-strong bg-bg p-1.5 focus-within:border-accent/60">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      send()
                    }
                  }}
                  rows={1}
                  placeholder="Message…"
                  className="max-h-40 resize-none border-0 bg-transparent focus:ring-0"
                />
                {streaming ? (
                  <Button type="button" onClick={() => (stopRef.current = true)} className="size-9 shrink-0 px-0" aria-label="Stop">
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
                  <span className={cn('truncate', e.line.startsWith('event: delta') ? 'text-muted' : 'text-accent')}>{e.line}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}

import { ArrowLeft, Eye, EyeOff, FlaskConical, History, Pause, Play, RefreshCw, RotateCcw, Upload } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CodeBlock,
  CopyButton,
  Field,
  Input,
  PageHeader,
  Select,
  StatusDot,
  Tabs,
  Textarea,
} from '../components/ui'
import { MODELS, PRICING } from '../data/mock'
import { useStore } from '../data/store'
import type { PlanLimit, Provider, RelayApp } from '../data/types'
import { cn } from '../lib/cn'
import { mask, timeAgo } from '../lib/format'
import { NotFound } from './NotFound'

type Tab = 'prompt' | 'model' | 'limits' | 'integration'

function variablesIn(text: string) {
  return [...new Set([...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]))]
}

function PromptTab({ app }: { app: RelayApp }) {
  const { publishPrompt, activateVersion } = useStore()
  const active = app.prompts.find((p) => p.version === app.activeVersion) ?? app.prompts[0]
  const [draft, setDraft] = useState(active.content)
  const [note, setNote] = useState('')
  const [viewing, setViewing] = useState<number | null>(null)
  const dirty = draft !== active.content
  const vars = variablesIn(draft)
  const viewed = app.prompts.find((p) => p.version === viewing)

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader
          title="System prompt"
          description="Lives on Relay, never in your app binary. Publishing takes effect on the next request."
          actions={dirty ? <Badge tone="warn">unpublished changes</Badge> : <Badge tone="success">v{active.version} live</Badge>}
        />
        <div className="p-5">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={14}
            spellCheck={false}
            className="font-mono text-[13px]"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>Variables:</span>
            {vars.length ? (
              vars.map((v) => (
                <code key={v} className="rounded bg-panel-2 px-1.5 py-0.5 font-mono text-info">
                  {`{{${v}}}`}
                </code>
              ))
            ) : (
              <span className="text-faint">none. Use {'{{name}}'} to inject values from your Lambda.</span>
            )}
            <span className="ml-auto tabular-nums text-faint">≈ {Math.ceil(draft.length / 4)} tokens</span>
          </div>
          <div className="mt-5 flex flex-col gap-2 border-t border-line pt-5 sm:flex-row">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changed? (optional)" className="flex-1" />
            <div className="flex gap-2">
              <Button variant="ghost" disabled={!dirty} onClick={() => setDraft(active.content)}>
                <RotateCcw className="size-4" /> Discard
              </Button>
              <Link to={`/playground?app=${app.id}`}>
                <Button>
                  <FlaskConical className="size-4" /> Test
                </Button>
              </Link>
              <Button
                variant="primary"
                disabled={!dirty || !draft.trim()}
                onClick={() => {
                  publishPrompt(app.id, draft, note.trim() || 'Untitled change')
                  setNote('')
                }}
              >
                <Upload className="size-4" /> Publish v{Math.max(...app.prompts.map((p) => p.version)) + 1}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title={<span className="flex items-center gap-2"><History className="size-4 text-muted" /> Versions</span>} />
        <ul>
          {app.prompts.map((p) => {
            const isActive = p.version === app.activeVersion
            return (
              <li key={p.version} className="border-t border-line px-5 py-3 first:border-t-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm">v{p.version}</span>
                  {isActive && <Badge tone="success">live</Badge>}
                  <span className="ml-auto text-xs text-faint">{timeAgo(p.createdAt)}</span>
                </div>
                <p className="mt-1 text-xs text-muted">{p.note}</p>
                <div className="mt-2 flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setViewing(viewing === p.version ? null : p.version)}>
                    {viewing === p.version ? 'Hide' : 'View'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDraft(p.content)}>
                    Edit from here
                  </Button>
                  {!isActive && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        activateVersion(app.id, p.version)
                        setDraft(p.content)
                      }}
                    >
                      Roll back
                    </Button>
                  )}
                </div>
                {viewed?.version === p.version && (
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-bg p-3 font-mono text-[11px] leading-relaxed text-muted">
                    {p.content}
                  </pre>
                )}
              </li>
            )
          })}
        </ul>
      </Card>
    </div>
  )
}

function ModelTab({ app }: { app: RelayApp }) {
  const { updateApp, providerKeys } = useStore()
  const price = PRICING[app.model]
  const missingKey = !providerKeys[app.provider]

  return (
    <Card className="max-w-2xl">
      <CardHeader title="Model" description="Changes apply to every new stream for this app." />
      <div className="space-y-5 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Provider">
            <Select
              value={app.provider}
              onChange={(e) => {
                const provider = e.target.value as Provider
                updateApp(app.id, { provider, model: MODELS[provider][0] })
              }}
            >
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
              <option value="google">Google</option>
            </Select>
          </Field>
          <Field label="Model" hint={price && `$${price[0]} in / $${price[1]} out per 1M tokens`}>
            <Select value={app.model} onChange={(e) => updateApp(app.id, { model: e.target.value })}>
              {MODELS[app.provider].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          </Field>
        </div>
        {missingKey && (
          <div className="rounded-lg border border-warn/30 bg-warn/5 px-4 py-3 text-sm text-warn">
            No {app.provider} key configured.{' '}
            <Link to="/settings" className="underline underline-offset-2">
              Add one in Provider keys
            </Link>{' '}
            before going live.
          </div>
        )}
        <Field label={`Temperature · ${app.temperature.toFixed(1)}`} hint="Lower is more predictable, higher is more creative.">
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={app.temperature}
            onChange={(e) => updateApp(app.id, { temperature: Number(e.target.value) })}
            className="w-full accent-accent"
          />
        </Field>
      </div>
    </Card>
  )
}

function LimitsTab({ app }: { app: RelayApp }) {
  const { updateApp } = useStore()
  const setLimit = (i: number, patch: Partial<PlanLimit>) =>
    updateApp(app.id, { limits: app.limits.map((l, j) => (j === i ? { ...l, ...patch } : l)) })

  return (
    <Card className="max-w-2xl">
      <CardHeader
        title="Usage limits"
        description="Enforced per user, keyed by the plan claim in the token your Lambda signs."
        actions={
          <Button
            size="sm"
            onClick={() =>
              updateApp(app.id, { limits: [...app.limits, { plan: `plan_${app.limits.length + 1}`, messagesPerDay: 50, maxOutputTokens: 1000 }] })
            }
          >
            Add plan
          </Button>
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-faint">
              <th className="px-5 py-2.5 font-normal">Plan</th>
              <th className="px-3 py-2.5 font-normal">Messages / day</th>
              <th className="px-3 py-2.5 font-normal">Max output tokens</th>
              <th className="px-5 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {app.limits.map((l, i) => (
              <tr key={i} className="border-t border-line">
                <td className="px-5 py-2.5">
                  <Input value={l.plan} onChange={(e) => setLimit(i, { plan: e.target.value })} className="h-8 w-32 font-mono" />
                </td>
                <td className="px-3 py-2.5">
                  <Input type="number" min={0} value={l.messagesPerDay} onChange={(e) => setLimit(i, { messagesPerDay: Number(e.target.value) })} className="h-8 w-28 tabular-nums" />
                </td>
                <td className="px-3 py-2.5">
                  <Input type="number" min={1} value={l.maxOutputTokens} onChange={(e) => setLimit(i, { maxOutputTokens: Number(e.target.value) })} className="h-8 w-28 tabular-nums" />
                </td>
                <td className="px-5 py-2.5 text-right">
                  <Button size="sm" variant="ghost" onClick={() => updateApp(app.id, { limits: app.limits.filter((_, j) => j !== i) })}>
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function IntegrationTab({ app }: { app: RelayApp }) {
  const { updateApp } = useStore()
  const [reveal, setReveal] = useState(false)

  const lambdaSnippet = `// In your Lambda: mint a short-lived token for the signed-in user
import { SignJWT } from 'jose'

const secret = new TextEncoder().encode(process.env.RELAY_SIGNING_SECRET)

export async function relayToken(user) {
  return new SignJWT({ app: '${app.slug}', plan: user.plan, vars: { /* prompt variables */ } })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setExpirationTime('5m')
    .sign(secret)
}`

  const clientSnippet = `// In your client: stream from Relay with the token
const res = await fetch('https://relay.cortexlumora.com/v1/chat', {
  method: 'POST',
  headers: { Authorization: \`Bearer \${token}\`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages }),
})

for await (const chunk of res.body.pipeThrough(new TextDecoderStream())) {
  render(chunk) // SSE events: delta, usage, done
}`

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <Card>
          <CardHeader title="Signing secret" description="Your Lambda signs user tokens with this. Keep it server-side." />
          <div className="space-y-4 p-5">
            <div className="flex items-center gap-1 rounded-lg border border-line-strong bg-bg px-3 py-2">
              <code className="flex-1 truncate font-mono text-xs">{reveal ? app.signingSecret : mask(app.signingSecret)}</code>
              <button onClick={() => setReveal(!reveal)} className="rounded-md p-1.5 text-muted hover:bg-panel-2 hover:text-fg" aria-label="Toggle secret">
                {reveal ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
              <CopyButton value={app.signingSecret} />
            </div>
            <Button variant="danger" size="sm">
              <RefreshCw className="size-3.5" /> Rotate secret
            </Button>
          </div>
        </Card>
        <Card>
          <CardHeader title="Completion webhook" description="Relay POSTs the final message + token usage here after each stream." />
          <div className="space-y-3 p-5">
            <Input
              value={app.webhookUrl}
              onChange={(e) => updateApp(app.id, { webhookUrl: e.target.value })}
              placeholder="https://xxxx.lambda-url.region.on.aws/relay/webhook"
              className="font-mono text-xs"
            />
            <div className="flex items-center gap-3">
              <Button size="sm" disabled={!app.webhookUrl}>
                Send test event
              </Button>
              <span className="text-xs text-faint">Signed with the same secret (X-Relay-Signature).</span>
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="App ID" />
          <div className="flex items-center gap-2 p-5">
            <code className="flex-1 font-mono text-xs text-muted">{app.slug}</code>
            <CopyButton value={app.slug} />
          </div>
        </Card>
      </div>
      <div className="space-y-4">
        <CodeBlock lang="lambda · ts" code={lambdaSnippet} />
        <CodeBlock lang="client · ts" code={clientSnippet} />
      </div>
    </div>
  )
}

export function AppDetail() {
  const { appId } = useParams()
  const { getApp, updateApp } = useStore()
  const [tab, setTab] = useState<Tab>('prompt')
  const app = appId ? getApp(appId) : undefined
  if (!app) return <NotFound />

  const live = app.status === 'live'

  return (
    <>
      <Link to="/apps" className="mb-4 inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
        <ArrowLeft className="size-3" /> Apps
      </Link>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-panel-2 text-lg">{app.emoji}</span>
            {app.name}
          </span>
        }
        description={
          <span className="flex items-center gap-2">
            <StatusDot live={live} />
            <span className={cn(live ? 'text-accent' : 'text-faint')}>{live ? 'Live' : 'Paused'}</span>
            <span className="text-faint">·</span>
            <span className="font-mono text-xs">{app.model}</span>
          </span>
        }
        actions={
          <Button onClick={() => updateApp(app.id, { status: live ? 'paused' : 'live' })}>
            {live ? <Pause className="size-4" /> : <Play className="size-4" />}
            {live ? 'Pause streams' : 'Go live'}
          </Button>
        }
      />
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'prompt', label: 'System prompt' },
          { id: 'model', label: 'Model' },
          { id: 'limits', label: 'Limits' },
          { id: 'integration', label: 'Integration' },
        ]}
      />
      {tab === 'prompt' && <PromptTab key={app.id} app={app} />}
      {tab === 'model' && <ModelTab app={app} />}
      {tab === 'limits' && <LimitsTab app={app} />}
      {tab === 'integration' && <IntegrationTab app={app} />}
    </>
  )
}

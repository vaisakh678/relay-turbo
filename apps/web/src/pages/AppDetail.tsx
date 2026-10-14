import type { AppDetailDTO, PlanLimitDTO, Provider } from '@repo/dto'
import { ArrowLeft, Eye, EyeOff, FlaskConical, History, Pause, Play, RefreshCw, RotateCcw, Save, Trash2, Upload } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { API_URL, ApiError } from '../api/client'
import {
  fetchSigningSecret,
  useActivateVersion,
  useApp,
  useDeleteApp,
  useProviderKeys,
  usePublishPrompt,
  useReplaceLimits,
  useRotateSecret,
  useUpdateApp,
} from '../api/hooks'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CodeBlock,
  CopyButton,
  Field,
  InlineError,
  Input,
  Loading,
  PageHeader,
  QueryError,
  Select,
  StatusDot,
  Tabs,
  Textarea,
} from '../components/ui'
import { cn } from '../lib/cn'
import { APP_EMOJIS } from '../lib/emojis'
import { timeAgo } from '../lib/format'
import { MODELS, PRICING } from '../lib/models'
import { NotFound } from './NotFound'

type Tab = 'prompt' | 'model' | 'limits' | 'integration' | 'settings'

function variablesIn(text: string) {
  return [...new Set([...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]!))]
}

function PromptTab({ app }: { app: AppDetailDTO }) {
  const publish = usePublishPrompt(app.id)
  const activate = useActivateVersion(app.id)
  const active = app.prompts.find((p) => p.version === app.activePromptVersion) ?? app.prompts[0]
  const [draft, setDraft] = useState(active?.content ?? '')
  const [note, setNote] = useState('')
  const [viewing, setViewing] = useState<number | null>(null)
  const dirty = draft !== active?.content
  const vars = variablesIn(draft)
  const nextVersion = Math.max(0, ...app.prompts.map((p) => p.version)) + 1

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader
          title="System prompt"
          description="Lives on Relay, never in your app binary. Publishing takes effect on the next request."
          actions={dirty ? <Badge tone="warn">unpublished changes</Badge> : <Badge tone="success">v{active?.version} live</Badge>}
        />
        <div className="p-5">
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={14} spellCheck={false} className="font-mono text-[13px]" />
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>Variables:</span>
            {vars.length ? (
              vars.map((v) => (
                <code key={v} className="rounded bg-panel-2 px-1.5 py-0.5 font-mono text-info">
                  {`{{${v}}}`}
                </code>
              ))
            ) : (
              <span className="text-faint">none. Use {'{{name}}'} to inject values per request.</span>
            )}
            <span className="ml-auto tabular-nums text-faint">≈ {Math.ceil(draft.length / 4)} tokens</span>
          </div>
          <div className="mt-5 flex flex-col gap-2 border-t border-line pt-5 sm:flex-row">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changed? (optional)" className="flex-1" />
            <div className="flex gap-2">
              <Button variant="ghost" disabled={!dirty} onClick={() => setDraft(active?.content ?? '')}>
                <RotateCcw className="size-4" /> Discard
              </Button>
              <Link to={`/playground?app=${app.id}`}>
                <Button>
                  <FlaskConical className="size-4" /> Test
                </Button>
              </Link>
              <Button
                variant="primary"
                disabled={!dirty || !draft.trim() || publish.isPending}
                onClick={() =>
                  publish.mutate({ content: draft, note: note.trim() || 'Untitled change' }, { onSuccess: () => setNote('') })
                }
              >
                <Upload className="size-4" /> {publish.isPending ? 'Publishing…' : `Publish v${nextVersion}`}
              </Button>
            </div>
          </div>
          <InlineError error={publish.error ?? activate.error} />
        </div>
      </Card>

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <History className="size-4 text-muted" /> Versions
            </span>
          }
        />
        <ul>
          {app.prompts.map((p) => {
            const isActive = p.version === app.activePromptVersion
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
                      disabled={activate.isPending}
                      onClick={() => activate.mutate(p.version, { onSuccess: () => setDraft(p.content) })}
                    >
                      Roll back
                    </Button>
                  )}
                </div>
                {viewing === p.version && (
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

function ModelTab({ app }: { app: AppDetailDTO }) {
  const update = useUpdateApp(app.id)
  const providerKeys = useProviderKeys()
  // Slider edits locally and saves on release, not on every tick.
  const [temperature, setTemperature] = useState(app.temperature)
  const price = PRICING[app.model]
  const missingKey = providerKeys.data && !providerKeys.data.find((k) => k.provider === app.provider)?.configured
  const commitTemperature = () => temperature !== app.temperature && update.mutate({ temperature })

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
                update.mutate({ provider, model: MODELS[provider][0]! })
              }}
            >
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
              <option value="google">Google</option>
            </Select>
          </Field>
          <Field label="Model" hint={price && `$${price[0]} in / $${price[1]} out per 1M tokens`}>
            <Select value={app.model} onChange={(e) => update.mutate({ model: e.target.value })}>
              {/* Keep a custom model selectable even if it's not in our list */}
              {[...new Set([app.model, ...MODELS[app.provider]])].map((m) => (
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
        <Field label={`Temperature · ${temperature.toFixed(1)}`} hint="Lower is more predictable, higher is more creative.">
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={temperature}
            onChange={(e) => setTemperature(Number(e.target.value))}
            onPointerUp={commitTemperature}
            onKeyUp={commitTemperature}
            className="w-full accent-accent"
          />
        </Field>
        <InlineError error={update.error} />
      </div>
    </Card>
  )
}

function LimitsTab({ app }: { app: AppDetailDTO }) {
  const replace = useReplaceLimits(app.id)
  const [rows, setRows] = useState<PlanLimitDTO[]>(app.limits)
  const dirty = JSON.stringify(rows) !== JSON.stringify(app.limits)
  const setRow = (i: number, patch: Partial<PlanLimitDTO>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  return (
    <Card className="max-w-2xl">
      <CardHeader
        title="Usage limits"
        description="Enforced per user per UTC day, keyed by the request's plan."
        actions={
          <Button size="sm" onClick={() => setRows([...rows, { plan: `plan_${rows.length + 1}`, messagesPerDay: 50, maxOutputTokens: 1000 }])}>
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
            {rows.map((l, i) => (
              <tr key={i} className="border-t border-line">
                <td className="px-5 py-2.5">
                  <Input value={l.plan} onChange={(e) => setRow(i, { plan: e.target.value })} className="h-8 w-32 font-mono" />
                </td>
                <td className="px-3 py-2.5">
                  <Input type="number" min={0} value={l.messagesPerDay} onChange={(e) => setRow(i, { messagesPerDay: Number(e.target.value) })} className="h-8 w-28 tabular-nums" />
                </td>
                <td className="px-3 py-2.5">
                  <Input type="number" min={1} value={l.maxOutputTokens} onChange={(e) => setRow(i, { maxOutputTokens: Number(e.target.value) })} className="h-8 w-28 tabular-nums" />
                </td>
                <td className="px-5 py-2.5 text-right">
                  <Button size="sm" variant="ghost" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
        <InlineError error={replace.error} />
        <span className="flex-1" />
        <Button variant="ghost" size="sm" disabled={!dirty} onClick={() => setRows(app.limits)}>
          Reset
        </Button>
        <Button variant="primary" size="sm" disabled={!dirty || replace.isPending} onClick={() => replace.mutate(rows)}>
          <Save className="size-3.5" /> {replace.isPending ? 'Saving…' : 'Save limits'}
        </Button>
      </div>
    </Card>
  )
}

function IntegrationTab({ app }: { app: AppDetailDTO }) {
  const update = useUpdateApp(app.id)
  const rotate = useRotateSecret(app.id)
  const [secret, setSecret] = useState<string | null>(null)
  const [secretError, setSecretError] = useState<Error | null>(null)
  const [confirmRotate, setConfirmRotate] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState(app.webhookUrl ?? '')
  const webhookDirty = webhookUrl !== (app.webhookUrl ?? '')

  const toggleReveal = async () => {
    if (secret) return setSecret(null)
    try {
      setSecret(await fetchSigningSecret(app.id))
    } catch (err) {
      setSecretError(err as Error)
    }
  }

  const curl = `curl -N ${API_URL}/chat \\
  -H 'Content-Type: application/json' \\
  -d '{
    "app": "${app.slug}",
    "user": "usr_123",
    "plan": "${app.limits[0]?.plan ?? 'free'}",
    "messages": [{ "role": "user", "content": "Hello!" }]
  }'`

  const webhookVerify = `// Your Lambda: verify Relay's completion webhook
import { createHmac, timingSafeEqual } from 'node:crypto'

export function verifyRelayWebhook(body: string, headers: Record<string, string>) {
  const ts = headers['x-relay-timestamp']
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 60) throw new Error('stale')
  const expected = createHmac('sha256', process.env.RELAY_SIGNING_SECRET!)
    .update(\`\${ts}.\${body}\`)
    .digest('hex')
  const sig = headers['x-relay-signature'] ?? ''
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))
    throw new Error('bad signature')
  return JSON.parse(body) // { id, app, user, plan, status, message, usage, ... }
}`

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <Card>
          <CardHeader title="Signing secret" description="Signs completion webhooks today; will sign user tokens once auth lands. Keep it server-side." />
          <div className="space-y-4 p-5">
            <div className="flex items-center gap-1 rounded-lg border border-line-strong bg-bg px-3 py-2">
              <code className="flex-1 truncate font-mono text-xs">{secret ?? app.signingSecretPreview}</code>
              <button onClick={toggleReveal} className="rounded-md p-1.5 text-muted hover:bg-panel-2 hover:text-fg" aria-label="Toggle secret">
                {secret ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
              {secret && <CopyButton value={secret} />}
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="danger"
                size="sm"
                disabled={rotate.isPending}
                onClick={() => {
                  if (!confirmRotate) return setConfirmRotate(true)
                  rotate.mutate(undefined, {
                    onSuccess: (r) => {
                      setSecret(r.signingSecret)
                      setConfirmRotate(false)
                    },
                  })
                }}
                onBlur={() => setConfirmRotate(false)}
              >
                <RefreshCw className="size-3.5" /> {confirmRotate ? 'Click again to rotate' : 'Rotate secret'}
              </Button>
              {confirmRotate && <span className="text-xs text-warn">Your Lambda must be updated with the new secret.</span>}
            </div>
            <InlineError error={secretError ?? rotate.error} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Completion webhook" description="Relay POSTs the final message + token usage here after each stream." />
          <div className="space-y-3 p-5">
            <div className="flex gap-2">
              <Input
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://xxxx.lambda-url.region.on.aws/relay/webhook"
                className="font-mono text-xs"
              />
              <Button disabled={!webhookDirty || update.isPending} onClick={() => update.mutate({ webhookUrl: webhookUrl.trim() || null })}>
                Save
              </Button>
            </div>
            <p className="text-xs text-faint">Signed with the secret above (X-Relay-Timestamp, X-Relay-Signature).</p>
            <InlineError error={update.error} />
          </div>
        </Card>
        <Card>
          <CardHeader title="App slug" description="Identifies this app in chat requests." />
          <div className="flex items-center gap-2 p-5">
            <code className="flex-1 font-mono text-xs text-muted">{app.slug}</code>
            <CopyButton value={app.slug} />
          </div>
        </Card>
      </div>
      <div className="space-y-4">
        <div className="rounded-lg border border-warn/30 bg-warn/5 px-4 py-3 text-xs leading-relaxed text-warn">
          Dev mode: the chat endpoint trusts <code>app</code>, <code>user</code> and <code>plan</code> from the request body. These move
          into a token signed by your backend once auth is added.
        </div>
        <CodeBlock lang="stream a reply · curl" code={curl} />
        <CodeBlock lang="lambda · ts" code={webhookVerify} />
      </div>
    </div>
  )
}

function SettingsTab({ app }: { app: AppDetailDTO }) {
  const update = useUpdateApp(app.id)
  const deleteApp = useDeleteApp(app.id)
  const navigate = useNavigate()
  const [name, setName] = useState(app.name)
  const [emoji, setEmoji] = useState(app.emoji)
  const [confirmSlug, setConfirmSlug] = useState('')
  const dirty = name.trim() !== app.name || emoji !== app.emoji
  // Keep the app's current emoji pickable even if it isn't one of the presets
  const emojis = APP_EMOJIS.includes(app.emoji) ? APP_EMOJIS : [app.emoji, ...APP_EMOJIS]

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader title="General" />
        <form
          className="space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault()
            if (dirty && name.trim()) update.mutate({ name: name.trim(), emoji })
          }}
        >
          <Field label="Name" hint={<>Display name only. The slug <code className="font-mono">{app.slug}</code> stays the same, so existing clients keep working.</>}>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </Field>
          <Field label="Icon">
            <div className="flex flex-wrap gap-1.5">
              {emojis.map((e) => (
                <button
                  type="button"
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={cn(
                    'flex size-9 items-center justify-center rounded-lg border text-lg',
                    emoji === e ? 'border-accent bg-accent/10' : 'border-line-strong bg-bg hover:bg-panel-2',
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </Field>
          <InlineError error={update.error} />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={!dirty}
              onClick={() => {
                setName(app.name)
                setEmoji(app.emoji)
              }}
            >
              Reset
            </Button>
            <Button type="submit" variant="primary" disabled={!dirty || !name.trim() || update.isPending}>
              <Save className="size-4" /> {update.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </Card>

      <div className="rounded-xl border border-danger/40 bg-danger/[0.03]">
        <div className="border-b border-danger/30 px-5 py-4">
          <h2 className="text-sm font-medium text-danger">Danger zone</h2>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <h3 className="text-sm font-medium">Delete this app</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Streams for <code className="font-mono">{app.slug}</code> stop immediately and the app disappears from the dashboard.
              Its request logs are kept. The slug becomes free to reuse.
            </p>
          </div>
          <Field label={`Type ${app.slug} to confirm`}>
            <Input
              value={confirmSlug}
              onChange={(e) => setConfirmSlug(e.target.value)}
              placeholder={app.slug}
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
            />
          </Field>
          <InlineError error={deleteApp.error} />
          <Button
            variant="danger"
            disabled={confirmSlug !== app.slug || deleteApp.isPending}
            onClick={() => deleteApp.mutate(undefined, { onSuccess: () => navigate('/apps', { replace: true }) })}
          >
            <Trash2 className="size-4" /> {deleteApp.isPending ? 'Deleting…' : 'Delete app'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function AppDetail() {
  const { appId = '' } = useParams()
  const app = useApp(appId)
  const update = useUpdateApp(appId)
  const [tab, setTab] = useState<Tab>('prompt')

  if (app.isPending) return <Loading />
  if (app.error instanceof ApiError && (app.error.status === 404 || app.error.status === 400)) return <NotFound />
  if (app.isError) return <QueryError error={app.error} onRetry={() => app.refetch()} />

  const live = app.data.status === 'live'

  return (
    <>
      <Link to="/apps" className="mb-4 inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
        <ArrowLeft className="size-3" /> Apps
      </Link>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-panel-2 text-lg">{app.data.emoji}</span>
            {app.data.name}
          </span>
        }
        description={
          <span className="flex items-center gap-2">
            <StatusDot live={live} />
            <span className={cn(live ? 'text-accent' : 'text-faint')}>{live ? 'Live' : 'Paused'}</span>
            <span className="text-faint">·</span>
            <span className="font-mono text-xs">{app.data.model}</span>
          </span>
        }
        actions={
          <Button onClick={() => update.mutate({ status: live ? 'paused' : 'live' })}>
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
          { id: 'settings', label: 'Settings' },
        ]}
      />
      {/* Keyed by app so local drafts reset when navigating between apps */}
      {tab === 'prompt' && <PromptTab key={app.data.id} app={app.data} />}
      {tab === 'model' && <ModelTab key={`${app.data.id}-${app.data.temperature}`} app={app.data} />}
      {tab === 'limits' && <LimitsTab key={app.data.id} app={app.data} />}
      {tab === 'integration' && <IntegrationTab key={app.data.id} app={app.data} />}
      {tab === 'settings' && <SettingsTab key={app.data.id} app={app.data} />}
    </>
  )
}

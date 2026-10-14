import type { Provider } from '@repo/dto'
import { Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useApps, useCreateApp, useStats } from '../api/hooks'
import { Badge, Button, Card, Field, InlineError, Input, Loading, Modal, PageHeader, QueryError, Select, StatusDot } from '../components/ui'
import { APP_EMOJIS } from '../lib/emojis'
import { compact, usd } from '../lib/format'
import { MODELS } from '../lib/models'

function NewAppModal({ onClose }: { onClose: () => void }) {
  const createApp = useCreateApp()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState(APP_EMOJIS[0]!)
  const [provider, setProvider] = useState<Provider>('anthropic')
  const [model, setModel] = useState(MODELS.anthropic[1]!)

  return (
    <Modal open onClose={onClose} title="New app">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return
          createApp.mutate(
            { name: name.trim(), emoji, provider, model },
            {
              onSuccess: (app) => {
                onClose()
                navigate(`/apps/${app.id}`)
              },
            },
          )
        }}
      >
        <Field label="Name">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. HabitFlo" />
        </Field>
        <Field label="Icon">
          <div className="flex flex-wrap gap-1.5">
            {APP_EMOJIS.map((e) => (
              <button
                type="button"
                key={e}
                onClick={() => setEmoji(e)}
                className={`flex size-9 items-center justify-center rounded-lg border text-lg ${
                  emoji === e ? 'border-accent bg-accent/10' : 'border-line-strong bg-bg hover:bg-panel-2'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Provider">
            <Select
              value={provider}
              onChange={(e) => {
                const p = e.target.value as Provider
                setProvider(p)
                setModel(MODELS[p][0]!)
              }}
            >
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
              <option value="google">Google</option>
            </Select>
          </Field>
          <Field label="Model">
            <Select value={model} onChange={(e) => setModel(e.target.value)}>
              {MODELS[provider].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          </Field>
        </div>
        <InlineError error={createApp.error} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={!name.trim() || createApp.isPending}>
            {createApp.isPending ? 'Creating…' : 'Create app'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export function Apps() {
  const apps = useApps()
  const stats = useStats(24)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)

  return (
    <>
      <PageHeader
        title="Apps"
        description="Each app gets its own system prompt, model, limits and signing secret."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> New app
          </Button>
        }
      />

      <div className="relative mb-4 max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search apps" className="pl-9" />
      </div>

      {apps.isPending ? (
        <Loading />
      ) : apps.isError ? (
        <QueryError error={apps.error} onRetry={() => apps.refetch()} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {apps.data
            .filter((a) => a.name.toLowerCase().includes(query.toLowerCase()))
            .map((a) => {
              const s = stats.data?.find((x) => x.appId === a.id)
              return (
                <Link key={a.id} to={`/apps/${a.id}`}>
                  <Card className="group h-full p-5 transition-colors hover:border-line-strong hover:bg-panel-2/40">
                    <div className="flex items-start justify-between">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-panel-2 text-xl">{a.emoji}</div>
                      <Badge tone={a.status === 'live' ? 'success' : 'neutral'}>
                        <StatusDot live={a.status === 'live'} />
                        {a.status}
                      </Badge>
                    </div>
                    <div className="mt-4 font-medium">{a.name}</div>
                    <div className="mt-0.5 font-mono text-xs text-faint">{a.model}</div>
                    <div className="mt-4 flex gap-4 border-t border-line pt-3 text-xs text-muted">
                      <span>
                        <span className="tabular-nums text-fg">{compact(s?.requests ?? 0)}</span> req
                      </span>
                      <span>
                        <span className="tabular-nums text-fg">{usd(s?.cost ?? 0)}</span> / 24h
                      </span>
                      <span className="ml-auto">prompt v{a.activePromptVersion}</span>
                    </div>
                  </Card>
                </Link>
              )
            })}
          <button
            onClick={() => setCreating(true)}
            className="flex min-h-44 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong text-sm text-muted transition-colors hover:border-accent/50 hover:text-fg"
          >
            <Plus className="size-5" />
            Connect another app
          </button>
        </div>
      )}

      {creating && <NewAppModal onClose={() => setCreating(false)} />}
    </>
  )
}

import { Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, StatusDot } from '../components/ui'
import { MODELS } from '../data/mock'
import { useStore } from '../data/store'
import type { Provider } from '../data/types'
import { compact, usd } from '../lib/format'

const EMOJIS = ['✨', '🤖', '📚', '🎧', '🧠', '🍳', '🪴', '💬', '🎮', '🧘']

function NewAppModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { createApp } = useStore()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState(EMOJIS[0])
  const [provider, setProvider] = useState<Provider>('anthropic')
  const [model, setModel] = useState(MODELS.anthropic[1])

  return (
    <Modal open={open} onClose={onClose} title="New app">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return
          const app = createApp({ name: name.trim(), emoji, provider, model })
          onClose()
          navigate(`/apps/${app.id}`)
        }}
      >
        <Field label="Name">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. HabitFlo" />
        </Field>
        <Field label="Icon">
          <div className="flex flex-wrap gap-1.5">
            {EMOJIS.map((e) => (
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
                setModel(MODELS[p][0])
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
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={!name.trim()}>
            Create app
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export function Apps() {
  const { apps } = useStore()
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const filtered = apps.filter((a) => a.name.toLowerCase().includes(query.toLowerCase()))

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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((a) => (
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
                  <span className="tabular-nums text-fg">{compact(a.stats.requests24h)}</span> req
                </span>
                <span>
                  <span className="tabular-nums text-fg">{usd(a.stats.cost24h)}</span> / 24h
                </span>
                <span className="ml-auto">prompt v{a.activeVersion}</span>
              </div>
            </Card>
          </Link>
        ))}
        <button
          onClick={() => setCreating(true)}
          className="flex min-h-44 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong text-sm text-muted transition-colors hover:border-accent/50 hover:text-fg"
        >
          <Plus className="size-5" />
          Connect another app
        </button>
      </div>

      {creating && <NewAppModal open onClose={() => setCreating(false)} />}
    </>
  )
}

import { Check } from 'lucide-react'
import { useState } from 'react'
import { Badge, Button, Card, CardHeader, Input, PageHeader } from '../components/ui'
import { useStore } from '../data/store'
import type { Provider } from '../data/types'
import { mask } from '../lib/format'

const PROVIDERS: { id: Provider; name: string; placeholder: string }[] = [
  { id: 'anthropic', name: 'Anthropic', placeholder: 'sk-ant-…' },
  { id: 'openai', name: 'OpenAI', placeholder: 'sk-proj-…' },
  { id: 'google', name: 'Google AI', placeholder: 'AIza…' },
]

function ProviderRow({ id, name, placeholder }: (typeof PROVIDERS)[number]) {
  const { providerKeys, setProviderKey, apps } = useStore()
  const current = providerKeys[id]
  const [editing, setEditing] = useState(!current)
  const [value, setValue] = useState('')
  const usedBy = apps.filter((a) => a.provider === id)

  return (
    <div className="flex flex-col gap-3 border-t border-line px-5 py-4 first:border-t-0 sm:flex-row sm:items-center">
      <div className="w-40 shrink-0">
        <div className="text-sm font-medium">{name}</div>
        <div className="mt-0.5 text-xs text-faint">
          {usedBy.length ? `Used by ${usedBy.length} app${usedBy.length > 1 ? 's' : ''}` : 'Not used yet'}
        </div>
      </div>
      {editing ? (
        <form
          className="flex flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!value.trim()) return
            setProviderKey(id, value.trim())
            setValue('')
            setEditing(false)
          }}
        >
          <Input type="password" value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className="font-mono text-xs" />
          <Button type="submit" variant="primary" disabled={!value.trim()}>
            Save
          </Button>
          {current && (
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          )}
        </form>
      ) : (
        <div className="flex flex-1 items-center gap-3">
          <code className="flex-1 truncate font-mono text-xs text-muted">{mask(current)}</code>
          <Badge tone="success">
            <Check className="size-3" /> connected
          </Badge>
          <Button size="sm" onClick={() => setEditing(true)}>
            Replace
          </Button>
        </div>
      )}
    </div>
  )
}

export function Settings() {
  return (
    <>
      <PageHeader
        title="Provider keys"
        description="Shared by every app. Keys are encrypted at rest and never sent to clients."
      />
      <Card className="max-w-3xl">
        <CardHeader title="LLM providers" />
        {PROVIDERS.map((p) => (
          <ProviderRow key={p.id} {...p} />
        ))}
      </Card>
    </>
  )
}

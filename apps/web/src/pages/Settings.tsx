import type { Provider, ProviderKeyDTO } from '@repo/dto'
import { Check } from 'lucide-react'
import { useState } from 'react'
import { useApps, useDeleteProviderKey, useProviderKeys, useSetProviderKey } from '../api/hooks'
import { Badge, Button, Card, CardHeader, InlineError, Input, Loading, PageHeader, QueryError } from '../components/ui'

const PROVIDERS: Record<Provider, { name: string; placeholder: string }> = {
  anthropic: { name: 'Anthropic', placeholder: 'sk-ant-…' },
  openai: { name: 'OpenAI', placeholder: 'sk-proj-…' },
  google: { name: 'Google AI', placeholder: 'AIza…' },
}

function ProviderRow({ providerKey }: { providerKey: ProviderKeyDTO }) {
  const { provider, configured, preview } = providerKey
  const apps = useApps()
  const setKey = useSetProviderKey()
  const deleteKey = useDeleteProviderKey()
  const [editing, setEditing] = useState(!configured)
  const [value, setValue] = useState('')
  const usedBy = apps.data?.filter((a) => a.provider === provider) ?? []
  const { name, placeholder } = PROVIDERS[provider]

  return (
    <div className="border-t border-line px-5 py-4 first:border-t-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
              setKey.mutate(
                { provider, apiKey: value.trim() },
                {
                  onSuccess: () => {
                    setValue('')
                    setEditing(false)
                  },
                },
              )
            }}
          >
            <Input type="password" value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className="font-mono text-xs" />
            <Button type="submit" variant="primary" disabled={!value.trim() || setKey.isPending}>
              {setKey.isPending ? 'Saving…' : 'Save'}
            </Button>
            {configured && (
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            )}
          </form>
        ) : (
          <div className="flex flex-1 items-center gap-3">
            <code className="flex-1 truncate font-mono text-xs text-muted">{preview}</code>
            <Badge tone="success">
              <Check className="size-3" /> connected
            </Badge>
            <Button size="sm" onClick={() => setEditing(true)}>
              Replace
            </Button>
            <Button size="sm" variant="ghost" disabled={deleteKey.isPending} onClick={() => deleteKey.mutate(provider, { onSuccess: () => setEditing(true) })}>
              Remove
            </Button>
          </div>
        )}
      </div>
      <InlineError error={setKey.error ?? deleteKey.error} />
    </div>
  )
}

export function Settings() {
  const keys = useProviderKeys()
  return (
    <>
      <PageHeader title="Provider keys" description="Shared by every app. Never sent to clients; the API only ever returns a masked preview." />
      <Card className="max-w-3xl">
        <CardHeader title="LLM providers" />
        {keys.isPending ? (
          <Loading />
        ) : keys.isError ? (
          <QueryError error={keys.error} onRetry={() => keys.refetch()} />
        ) : (
          keys.data.map((k) => <ProviderRow key={`${k.provider}-${k.configured}`} providerKey={k} />)
        )}
      </Card>
    </>
  )
}

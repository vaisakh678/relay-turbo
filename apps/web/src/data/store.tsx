import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { seedApps, seedLogs, seedProviderKeys } from './mock'
import type { LogEntry, Provider, RelayApp } from './types'

// In-memory store backed by mock data. Swap for API calls once the gateway exists.
type Store = {
  apps: RelayApp[]
  logs: LogEntry[]
  providerKeys: Record<Provider, string>
  getApp: (id: string) => RelayApp | undefined
  updateApp: (id: string, patch: Partial<RelayApp>) => void
  createApp: (input: Pick<RelayApp, 'name' | 'emoji' | 'provider' | 'model'>) => RelayApp
  publishPrompt: (id: string, content: string, note: string) => void
  activateVersion: (id: string, version: number) => void
  setProviderKey: (provider: Provider, key: string) => void
}

const StoreContext = createContext<Store | null>(null)

function randomSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  return `rls_live_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [apps, setApps] = useState(seedApps)
  const [logs] = useState(() => seedLogs(seedApps))
  const [providerKeys, setProviderKeys] = useState(seedProviderKeys)

  const store = useMemo<Store>(() => {
    const updateApp = (id: string, patch: Partial<RelayApp>) =>
      setApps((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)))

    return {
      apps,
      logs,
      providerKeys,
      getApp: (id) => apps.find((a) => a.id === id),
      updateApp,
      createApp: (input) => {
        const slug = slugify(input.name)
        const app: RelayApp = {
          ...input,
          id: `app_${slug.replace(/-/g, '_')}_${Date.now().toString(36)}`,
          slug,
          status: 'paused',
          temperature: 0.7,
          webhookUrl: '',
          signingSecret: randomSecret(),
          activeVersion: 1,
          prompts: [
            {
              version: 1,
              note: 'Initial prompt',
              createdAt: new Date().toISOString(),
              content: `You are the assistant for ${input.name}.`,
            },
          ],
          limits: [
            { plan: 'free', messagesPerDay: 10, maxOutputTokens: 600 },
            { plan: 'pro', messagesPerDay: 200, maxOutputTokens: 2000 },
          ],
          stats: { requests24h: 0, tokens24h: 0, cost24h: 0, p50LatencyMs: 0, errorRate: 0 },
          createdAt: new Date().toISOString(),
        }
        setApps((prev) => [...prev, app])
        return app
      },
      publishPrompt: (id, content, note) =>
        setApps((prev) =>
          prev.map((a) => {
            if (a.id !== id) return a
            const version = Math.max(...a.prompts.map((p) => p.version)) + 1
            return {
              ...a,
              activeVersion: version,
              prompts: [{ version, content, note, createdAt: new Date().toISOString() }, ...a.prompts],
            }
          }),
        ),
      activateVersion: (id, version) => updateApp(id, { activeVersion: version }),
      setProviderKey: (provider, key) => setProviderKeys((prev) => ({ ...prev, [provider]: key })),
    }
  }, [apps, logs, providerKeys])

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>')
  return ctx
}

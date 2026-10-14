import { useQueryClient } from '@tanstack/react-query'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { authClient } from '../lib/auth-client'
import { cn } from '../lib/cn'

const initial = (name: string) => name.trim().charAt(0).toUpperCase() || 'W'

function slugify(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'workspace'
  return `${base}-${Math.random().toString(36).slice(2, 7)}`
}

export function WorkspaceSwitcher() {
  const qc = useQueryClient()
  const session = authClient.useSession()
  const workspaces = authClient.useListOrganizations()
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const activeId = session.data?.session.activeOrganizationId
  const active = workspaces.data?.find((w) => w.id === activeId) ?? workspaces.data?.[0]

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  // Everything the dashboard shows belongs to the active workspace: drop all cached data on switch
  async function activate(id: string) {
    setOpen(false)
    if (id === activeId) return
    await authClient.organization.setActive({ organizationId: id })
    await session.refetch()
    qc.clear()
  }

  async function create() {
    setError('')
    const { data, error } = await authClient.organization.create({ name: name.trim(), slug: slugify(name) })
    if (error || !data) return setError(error?.message ?? 'Could not create workspace')
    setName('')
    setCreating(false)
    await workspaces.refetch()
    await activate(data.id)
  }

  return (
    <div ref={ref} className="relative mt-5">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2.5 rounded-lg border border-line bg-panel-2/40 px-2.5 py-2 text-left hover:bg-panel-2"
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-accent/15 text-[11px] font-semibold text-accent">
          {initial(active?.name ?? '')}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm">{active?.name ?? 'Loading…'}</span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-faint" />
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full z-50 mt-1 rounded-lg border border-line-strong bg-panel p-1 shadow-xl">
          <div className="px-2 pb-1 pt-1.5 text-[11px] text-faint">Workspaces</div>
          {workspaces.data?.map((w) => (
            <button
              key={w.id}
              onClick={() => void activate(w.id)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-panel-2"
            >
              <span className="flex size-5 items-center justify-center rounded bg-panel-2 text-[10px] font-semibold">{initial(w.name)}</span>
              <span className="min-w-0 flex-1 truncate">{w.name}</span>
              {w.id === active?.id && <Check className="size-3.5 text-accent" />}
            </button>
          ))}
          <div className="my-1 h-px bg-line" />
          {creating ? (
            <form
              className="space-y-1.5 p-1"
              onSubmit={(e) => {
                e.preventDefault()
                if (name.trim()) void create()
              }}
            >
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Workspace name"
                maxLength={60}
                className="h-8 w-full rounded-md border border-line-strong bg-bg px-2 text-sm focus:border-accent/60 focus:outline-none"
              />
              {error && <p className="text-[11px] text-danger">{error}</p>}
              <div className="flex justify-end gap-1">
                <button type="button" onClick={() => setCreating(false)} className="rounded px-2 py-1 text-xs text-muted hover:text-fg">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!name.trim()}
                  className={cn('rounded bg-accent px-2 py-1 text-xs font-medium text-accent-fg', !name.trim() && 'opacity-50')}
                >
                  Create
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted hover:bg-panel-2 hover:text-fg"
            >
              <Plus className="size-4" /> New workspace
            </button>
          )}
        </div>
      )}
    </div>
  )
}

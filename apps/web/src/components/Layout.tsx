import { Activity, AppWindow, FlaskConical, KeyRound, LayoutDashboard, LogOut, Menu, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { API_URL } from '../api/client'
import { useHealth } from '../api/hooks'
import { authClient, type Session } from '../lib/auth-client'
import { cn } from '../lib/cn'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'

const nav = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/apps', label: 'Apps', icon: AppWindow },
  { to: '/playground', label: 'Playground', icon: FlaskConical },
  { to: '/logs', label: 'Logs', icon: Activity },
  { to: '/settings', label: 'Provider keys', icon: KeyRound },
]

function Logo() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <svg viewBox="0 0 32 32" className="size-7">
        <rect width="32" height="32" rx="8" className="fill-panel-2" />
        <path d="M8 20c4 0 4-8 8-8s4 8 8 8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-accent" />
      </svg>
      <span className="text-[15px] font-semibold tracking-tight">Relay</span>
    </div>
  )
}

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="mt-4 space-y-0.5">
      {nav.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
              isActive ? 'bg-panel-2 text-fg' : 'text-muted hover:bg-panel-2/60 hover:text-fg',
            )
          }
        >
          <Icon className="size-4" />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

function GatewayStatus() {
  const health = useHealth()
  const ok = health.isSuccess
  return (
    <div className="rounded-lg border border-line bg-panel-2/50 p-3 text-xs">
      <div className="flex items-center gap-2 text-muted">
        <span className={cn('size-1.5 rounded-full', health.isPending ? 'bg-faint' : ok ? 'bg-accent' : 'bg-danger')} />
        {health.isPending ? 'Checking gateway…' : ok ? 'Gateway healthy' : 'Gateway unreachable'}
      </div>
      <div className="mt-1 truncate font-mono text-[11px] text-faint">{API_URL.replace(/^https?:\/\//, '')}</div>
    </div>
  )
}

function UserMenu({ user }: { user: Session['user'] }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)
  return (
    <div className="flex items-center gap-2.5 border-t border-line px-1 pt-3">
      {user.image ? (
        <img src={user.image} alt="" referrerPolicy="no-referrer" className="size-8 shrink-0 rounded-full" />
      ) : (
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
          {(user.name || user.email).charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{user.name || user.email.split('@')[0]}</div>
        <div className="truncate text-[11px] text-faint">{user.email}</div>
      </div>
      <button
        disabled={signingOut}
        onClick={async () => {
          setSigningOut(true)
          await authClient.signOut()
          qc.clear()
          navigate('/login', { replace: true })
        }}
        className="rounded-md p-1.5 text-faint hover:bg-panel-2 hover:text-fg disabled:opacity-50"
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut className="size-4" />
      </button>
    </div>
  )
}

function Footer({ user }: { user: Session['user'] }) {
  return (
    <div className="mt-auto space-y-3">
      <GatewayStatus />
      <UserMenu user={user} />
    </div>
  )
}

export function Layout() {
  const [open, setOpen] = useState(false)
  const session = authClient.useSession()
  const location = useLocation()

  if (session.isPending) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <span className="size-5 animate-spin rounded-full border-2 border-line-strong border-t-accent" />
      </div>
    )
  }
  // Signed out (or session expired): send to login, then back here afterwards
  if (!session.data) {
    const next = location.pathname + location.search
    return <Navigate to={next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`} replace />
  }
  const user = session.data.user

  return (
    <div className="flex min-h-full">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-panel/60 p-4 md:flex">
        <Logo />
        <WorkspaceSwitcher />
        <Nav />
        <Footer user={user} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setOpen(false)}>
          <aside
            className="flex h-full w-64 flex-col border-r border-line bg-panel p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <Logo />
              <button onClick={() => setOpen(false)} className="p-1 text-muted" aria-label="Close menu">
                <X className="size-5" />
              </button>
            </div>
            <WorkspaceSwitcher />
            <Nav onNavigate={() => setOpen(false)} />
            <Footer user={user} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-bg/80 px-4 backdrop-blur md:hidden">
          <button onClick={() => setOpen(true)} className="p-1 text-muted" aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <Logo />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

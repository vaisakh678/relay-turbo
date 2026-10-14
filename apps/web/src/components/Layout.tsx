import { Activity, AppWindow, FlaskConical, KeyRound, LayoutDashboard, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import { cn } from '../lib/cn'

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
    <nav className="mt-6 space-y-0.5">
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

function Footer() {
  return (
    <div className="mt-auto rounded-lg border border-line bg-panel-2/50 p-3 text-xs">
      <div className="flex items-center gap-2 text-muted">
        <span className="size-1.5 rounded-full bg-accent" />
        Gateway healthy
      </div>
      <div className="mt-1 font-mono text-[11px] text-faint">relay.cortexlumora.com</div>
    </div>
  )
}

export function Layout() {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex min-h-full">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-panel/60 p-4 md:flex">
        <Logo />
        <Nav />
        <Footer />
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
            <Nav onNavigate={() => setOpen(false)} />
            <Footer />
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

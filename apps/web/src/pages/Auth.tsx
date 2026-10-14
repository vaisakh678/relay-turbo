import { ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button, Field, Input } from '../components/ui'
import { cn } from '../lib/cn'

type Mode = 'login' | 'signup'
type Pending = 'google' | 'github' | 'email' | null

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.92l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.29 14.28A7.2 7.2 0 0 1 4.91 12c0-.79.14-1.56.38-2.28v-3.1H1.28A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.38l4.01-3.1Z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.98 11.98 0 0 0 1.28 6.62l4.01 3.1C6.23 6.88 8.88 4.77 12 4.77Z" />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
      <path d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.57L9 21.07c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18a4.65 4.65 0 0 1 1.23 3.22c0 4.61-2.8 5.63-5.48 5.92.42.36.81 1.1.81 2.22l-.01 3.29c0 .31.2.69.82.57A12 12 0 0 0 12 .3Z" />
    </svg>
  )
}

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="size-8">
        <rect width="32" height="32" rx="8" className="fill-panel-2" />
        <path d="M8 20c4 0 4-8 8-8s4 8 8 8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-accent" />
      </svg>
      <span className="text-base font-semibold tracking-tight">Relay</span>
    </Link>
  )
}

// Right-hand showcase: a looping fake stream so the page shows what the product does
const DEMO = [
  { app: '🌙 Luna Stories', text: 'Once upon a time, in a meadow where the fireflies hummed lullabies, a little fox named Pip…' },
  { app: '🔥 Roast Bot', text: 'Fourteen unfinished side projects? That is not a portfolio, that is a graveyard tour.' },
  { app: '💨 Puff Logger', text: 'Three days under ten puffs is real progress. Try a five-minute walk before the next craving.' },
]

function StreamShowcase() {
  const [i, setI] = useState(0)
  const [n, setN] = useState(0)
  const [fading, setFading] = useState(false)
  const demo = DEMO[i]
  const words = demo.text.split(' ')
  const done = n >= words.length

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    if (fading) {
      // Swap to the next demo once the fade-out has finished
      t = setTimeout(() => {
        setI((i + 1) % DEMO.length)
        setN(0)
        setFading(false)
      }, 350)
    } else if (done) {
      t = setTimeout(() => setFading(true), 2000)
    } else {
      // Jittered cadence like a real token stream, with a beat after punctuation
      const prev = DEMO[i].text.split(' ')[n - 1] ?? ''
      const pause = /[.,?!…]$/.test(prev) ? 180 : 0
      t = setTimeout(() => setN(n + 1), (n === 0 ? 400 : 45 + Math.random() * 55) + pause)
    }
    return () => clearTimeout(t)
  }, [i, n, done, fading])

  return (
    <div className="relative hidden overflow-hidden border-l border-line bg-panel lg:flex lg:flex-col lg:justify-center lg:px-14">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: 'radial-gradient(var(--color-line-strong) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        }}
      />
      <div className="relative mx-auto w-full max-w-md">
        <h2 className="text-2xl font-semibold leading-tight tracking-tight">
          One gateway.
          <br />
          <span className="text-muted">Every AI stream across your apps.</span>
        </h2>
        <p className="mt-3 text-sm text-muted">
          Keep your backend on Lambda. Relay holds the system prompts, provider keys and usage limits, and streams tokens straight to your users.
        </p>

        <div className="mt-8 overflow-hidden rounded-xl border border-line-strong bg-bg shadow-2xl">
          <div className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-xs">
            <span className="size-1.5 rounded-full bg-accent" />
            <span className={cn('text-muted transition-opacity duration-300', fading && 'opacity-0')}>{demo.app}</span>
            <span className="ml-auto font-mono text-faint">text/event-stream</span>
          </div>
          <div className={cn('min-h-28 p-4 text-sm leading-relaxed transition-opacity duration-300', fading && 'opacity-0')}>
            {words.slice(0, n).map((w, k) => (
              <span key={`${i}-${k}`} className="token">
                {k > 0 && ' '}
                {w}
              </span>
            ))}
            <span className={cn('caret', !done && 'caret-solid')} />
          </div>
          <div className="flex gap-4 border-t border-line px-4 py-2 font-mono text-[11px] text-faint">
            <span>ttft 312ms</span>
            <span>{n} tokens</span>
            <span className="ml-auto">prompt v3</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function OAuthButton({ icon, label, loading, disabled, onClick }: { icon: ReactNode; label: string; loading: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <Button type="button" onClick={onClick} disabled={disabled} className="h-10 w-full">
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {label}
    </Button>
  )
}

function AuthPage({ mode }: { mode: Mode }) {
  const navigate = useNavigate()
  const [pending, setPending] = useState<Pending>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const signup = mode === 'signup'

  // UI only: fake the round-trip, then land on the dashboard
  function start(kind: Exclude<Pending, null>) {
    setError('')
    setPending(kind)
    setTimeout(() => navigate('/'), 900)
  }

  return (
    <div className="grid min-h-full lg:grid-cols-2">
      <div className="flex flex-col px-4 py-8 sm:px-10">
        <Logo />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="text-2xl font-semibold tracking-tight">{signup ? 'Create your account' : 'Welcome back'}</h1>
          <p className="mt-1.5 text-sm text-muted">
            {signup ? 'Connect your first app in under five minutes.' : 'Sign in to manage your apps and streams.'}
          </p>

          <div className="mt-8 grid gap-2.5">
            <OAuthButton
              icon={<GoogleIcon />}
              label="Continue with Google"
              loading={pending === 'google'}
              disabled={pending !== null}
              onClick={() => start('google')}
            />
            <OAuthButton
              icon={<GitHubIcon />}
              label="Continue with GitHub"
              loading={pending === 'github'}
              disabled={pending !== null}
              onClick={() => start('github')}
            />
          </div>

          <div className="my-6 flex items-center gap-3 text-xs text-faint">
            <span className="h-px flex-1 bg-line" />
            or with email
            <span className="h-px flex-1 bg-line" />
          </div>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (signup && password.length < 8) return setError('Password must be at least 8 characters.')
              start('email')
            }}
          >
            {signup && (
              <Field label="Name">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" autoComplete="name" required className="h-10" />
              </Field>
            )}
            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" required className="h-10" />
            </Field>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className="text-xs font-medium text-muted">
                  Password
                </label>
                {!signup && (
                  <a href="#" className="text-xs text-muted hover:text-fg">
                    Forgot password?
                  </a>
                )}
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setError('')
                  }}
                  placeholder={signup ? 'At least 8 characters' : '••••••••'}
                  autoComplete={signup ? 'new-password' : 'current-password'}
                  required
                  className={cn('h-10 pr-10', error && 'border-danger/60')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-faint hover:text-fg"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
            </div>
            <Button type="submit" variant="primary" disabled={pending !== null} className="h-10 w-full">
              {pending === 'email' ? <Loader2 className="size-4 animate-spin" /> : null}
              {signup ? 'Create account' : 'Sign in'}
              {pending !== 'email' && <ArrowRight className="size-4" />}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            {signup ? 'Already have an account? ' : "Don't have an account? "}
            <Link to={signup ? '/login' : '/signup'} className="font-medium text-fg hover:text-accent">
              {signup ? 'Sign in' : 'Sign up'}
            </Link>
          </p>
        </div>
        {signup && (
          <p className="mx-auto max-w-sm text-center text-xs text-faint">
            By creating an account you agree to the{' '}
            <a href="#" className="underline underline-offset-2 hover:text-muted">
              Terms
            </a>{' '}
            and{' '}
            <a href="#" className="underline underline-offset-2 hover:text-muted">
              Privacy Policy
            </a>
            .
          </p>
        )}
      </div>
      <StreamShowcase />
    </div>
  )
}

export const Login = () => <AuthPage mode="login" />
export const Signup = () => <AuthPage mode="signup" />

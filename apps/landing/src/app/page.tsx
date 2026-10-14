import { SdkTabs } from "@/components/SdkTabs";
import { StreamDemo } from "@/components/StreamDemo";
import { APP_URL, GITHUB_URL } from "@/lib";
import type { ReactNode } from "react";

function Logo() {
  return (
    <a href="#" className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="size-7">
        <rect width="32" height="32" rx="8" className="fill-panel-2" />
        <path d="M8 20c4 0 4-8 8-8s4 8 8 8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-accent" />
      </svg>
      <span className="text-[15px] font-semibold tracking-tight">Relay</span>
    </a>
  );
}

function Button({ href, primary, children }: { href: string; primary?: boolean; children: ReactNode }) {
  return (
    <a
      href={href}
      className={
        primary
          ? "inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-5 text-sm font-medium text-accent-fg transition-colors hover:bg-accent/90"
          : "inline-flex h-11 items-center gap-2 rounded-lg border border-line-strong bg-panel-2 px-5 text-sm font-medium transition-colors hover:bg-line"
      }
    >
      {children}
    </a>
  );
}

function Section({ id, eyebrow, title, intro, children }: { id: string; eyebrow: string; title: ReactNode; intro?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-line py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">{eyebrow}</p>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
        {intro && <p className="mt-4 max-w-2xl text-muted">{intro}</p>}
        <div className="mt-12">{children}</div>
      </div>
    </section>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-bg/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-4 sm:px-6">
        <Logo />
        <nav className="hidden gap-6 text-sm text-muted md:flex">
          <a href="#how" className="hover:text-fg">How it works</a>
          <a href="#features" className="hover:text-fg">Features</a>
          <a href="#sdks" className="hover:text-fg">SDKs</a>
          <a href="#faq" className="hover:text-fg">FAQ</a>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <a href={GITHUB_URL} className="hidden text-sm text-muted hover:text-fg sm:block">GitHub</a>
          <a href={`${APP_URL}/login`} className="px-3 text-sm text-muted hover:text-fg">Sign in</a>
          <a href={`${APP_URL}/signup`} className="inline-flex h-9 items-center rounded-lg bg-accent px-3.5 text-sm font-medium text-accent-fg hover:bg-accent/90">
            Get started
          </a>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: "radial-gradient(var(--color-line-strong) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 30%, black, transparent)",
        }}
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pb-24 pt-20 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-28">
        <div>
          <a href="#faq" className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-panel px-3 py-1 text-xs text-muted hover:text-fg">
            <span className="size-1.5 rounded-full bg-accent" />
            Your backend stays on Lambda
          </a>
          <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            Stream AI to your apps
            <span className="text-muted">, from any backend.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted">
            Relay is one streaming gateway for all your AI apps. It holds your system prompts, provider keys and per-user limits, and
            streams tokens straight to your users over SSE, while your API keeps doing auth and data.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button href={`${APP_URL}/signup`} primary>
              Connect your first app
              <span aria-hidden>→</span>
            </Button>
            <Button href="#how">See how it works</Button>
          </div>
          <p className="mt-6 font-mono text-xs text-faint">Anthropic · OpenAI · Google</p>
        </div>
        <StreamDemo />
      </div>
    </section>
  );
}

function Diagram() {
  // Boxes: app (left), relay (center), providers (right), lambda (bottom-left)
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel p-4 sm:p-8">
      <svg viewBox="0 0 860 320" className="h-auto w-full" role="img" aria-label="Your app gets a token from your Lambda, streams from Relay, and Relay calls the model provider and posts usage back to your Lambda">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" fill="var(--color-faint)" />
          </marker>
        </defs>

        {/* app ↔ lambda: token */}
        <path d="M120 112 V218" stroke="var(--color-line-strong)" strokeWidth="2" fill="none" markerEnd="url(#arrow)" markerStart="url(#arrow)" />
        <text x="132" y="170" fill="var(--color-muted)" fontSize="13">① token</text>

        {/* app ↔ relay: SSE */}
        <path d="M212 70 H372" stroke="var(--color-accent)" strokeWidth="2.5" fill="none" className="flow" />
        <text x="292" y="56" fill="var(--color-accent)" fontSize="13" textAnchor="middle">② SSE stream</text>

        {/* relay ↔ providers */}
        <path d="M548 70 H648" stroke="var(--color-accent)" strokeWidth="2.5" fill="none" className="flow" />

        {/* relay → lambda: webhook */}
        <path d="M460 112 V262 H232" stroke="var(--color-line-strong)" strokeWidth="2" fill="none" markerEnd="url(#arrow)" />
        <text x="472" y="200" fill="var(--color-muted)" fontSize="13">③ webhook: message + usage</text>

        {/* your app */}
        <rect x="28" y="28" width="184" height="84" rx="12" fill="var(--color-panel-2)" stroke="var(--color-line-strong)" />
        <text x="120" y="64" fill="var(--color-fg)" fontSize="16" fontWeight="600" textAnchor="middle">Your app</text>
        <text x="120" y="88" fill="var(--color-faint)" fontSize="12" textAnchor="middle">iOS · Android · web</text>

        {/* relay */}
        <rect x="372" y="28" width="176" height="84" rx="12" fill="color-mix(in oklab, var(--color-accent) 10%, var(--color-panel-2))" stroke="var(--color-accent)" />
        <text x="460" y="64" fill="var(--color-fg)" fontSize="16" fontWeight="600" textAnchor="middle">Relay</text>
        <text x="460" y="88" fill="var(--color-muted)" fontSize="12" textAnchor="middle">prompts · keys · limits</text>

        {/* providers */}
        <rect x="648" y="28" width="184" height="84" rx="12" fill="var(--color-panel-2)" stroke="var(--color-line-strong)" />
        <text x="740" y="64" fill="var(--color-fg)" fontSize="16" fontWeight="600" textAnchor="middle">LLM provider</text>
        <text x="740" y="88" fill="var(--color-faint)" fontSize="12" textAnchor="middle">Anthropic · OpenAI · Google</text>

        {/* lambda */}
        <rect x="28" y="220" width="204" height="84" rx="12" fill="var(--color-panel-2)" stroke="var(--color-line-strong)" />
        <text x="130" y="256" fill="var(--color-fg)" fontSize="16" fontWeight="600" textAnchor="middle">Your Lambda</text>
        <text x="130" y="280" fill="var(--color-faint)" fontSize="12" textAnchor="middle">auth · users · database</text>
      </svg>
    </div>
  );
}

const STEPS = [
  {
    title: "Your Lambda signs a token",
    body: "After your normal auth check, mint a 5-minute token with the user ID, their plan and any prompt variables. One function call.",
  },
  {
    title: "Your app streams from Relay",
    body: "The client opens an SSE stream with that token. Relay injects the system prompt, enforces the plan's limits and streams tokens back.",
  },
  {
    title: "Relay reports back",
    body: "When the stream ends, even if the user closed the app, Relay POSTs the final message and token usage to your Lambda.",
  },
];

const FEATURES = [
  {
    title: "Prompts off the device",
    body: "System prompts live on Relay, versioned with notes. Edit, publish and roll back without shipping an app update.",
  },
  {
    title: "Provider keys in one place",
    body: "Your Anthropic, OpenAI and Google keys never touch a client. Switch a whole app to a new model from the dashboard.",
  },
  {
    title: "Per-user, per-plan limits",
    body: "Daily message caps and max output tokens per plan, so one free user can't burn through your margin.",
  },
  {
    title: "Cost per app",
    body: "Requests, tokens, spend and time-to-first-token for every app. Know which of your apps actually pays for itself.",
  },
  {
    title: "SSE done properly",
    body: "Heartbeats through proxies, upstream cancel when users leave, and resume from the last event on flaky mobile networks.",
  },
  {
    title: "A playground for every app",
    body: "Test the live prompt as any plan, fill in variables, and watch the raw stream events before your users do.",
  },
];

const FAQ = [
  {
    q: "Can't Lambda stream on its own?",
    a: "Partly. Function URLs and REST APIs can stream with some setup, but HTTP APIs buffer, and you'd still rebuild prompts, keys, limits and usage tracking in every app. Relay does that once, for all of them.",
  },
  {
    q: "Do you store my users' messages?",
    a: "No. Relay logs metadata (tokens, latency, status) and sends the finished message to your webhook. Your database stays the source of truth.",
  },
  {
    q: "Why SSE and not WebSockets?",
    a: "Chat is one request in, one stream out. SSE is plain HTTP, works through every proxy and CDN, and scales without sticky sessions. Real-time voice is the exception, and that would get its own endpoint.",
  },
  {
    q: "Which models are supported?",
    a: "Anthropic, OpenAI and Google to start. Each app picks its own provider and model, and you can switch without touching client code.",
  },
];

export default function Home() {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <Hero />

        <Section
          id="how"
          eyebrow="How it works"
          title="Your backend does auth. Relay does the streaming."
          intro="Nothing moves off Lambda. Relay sits beside it and handles the one thing Lambda is bad at: holding a long-lived stream open."
        >
          <Diagram />
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span className="flex size-7 items-center justify-center rounded-full border border-line-strong font-mono text-xs text-accent">{i + 1}</span>
                <h3 className="mt-4 font-medium">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="features" eyebrow="Features" title="Everything you'd otherwise rebuild in every app.">
          <div className="grid overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 1 }}>
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-panel p-6">
                <h3 className="font-medium">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section
          id="sdks"
          eyebrow="SDKs"
          title="A few lines on each side."
          intro="Thin, dependency-free SDKs that speak each platform's idiom: async iterators, AsyncStream, Flow. Token refresh, cancellation and reconnects are handled for you."
        >
          <SdkTabs />
        </Section>

        <Section id="faq" eyebrow="FAQ" title="Questions">
          <div className="divide-y divide-line border-y border-line">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="text-xl leading-none text-faint transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </Section>

        <section className="border-t border-line py-24">
          <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Ship the AI feature, not the plumbing.</h2>
            <p className="mx-auto mt-4 max-w-xl text-muted">Connect your first app in about five minutes.</p>
            <div className="mt-8 flex justify-center gap-3">
              <Button href={`${APP_URL}/signup`} primary>
                Get started <span aria-hidden>→</span>
              </Button>
              <Button href={GITHUB_URL}>View on GitHub</Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-faint sm:flex-row sm:px-6">
          <Logo />
          <p>© {new Date().getFullYear()} Cortex Lumora</p>
        </div>
      </footer>
    </>
  );
}

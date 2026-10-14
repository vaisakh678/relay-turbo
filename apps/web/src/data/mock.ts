import type { LogEntry, LogStatus, Provider, RelayApp } from './types'

export const MODELS: Record<Provider, string[]> = {
  anthropic: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'],
  openai: ['gpt-5', 'gpt-5-mini'],
  google: ['gemini-2.5-pro', 'gemini-2.5-flash'],
}

// $ per 1M tokens [input, output] — placeholder numbers for the mock UI
export const PRICING: Record<string, [number, number]> = {
  'claude-opus-5-5': [5, 25],
  'claude-sonnet-5-5': [3, 15],
  'claude-haiku-5-5': [1, 5],
  'gpt-5': [1.25, 10],
  'gpt-5-mini': [0.25, 2],
  'gemini-2.5-pro': [1.25, 10],
  'gemini-2.5-flash': [0.3, 2.5],
}

const now = Date.now()
const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString()

const defaultLimits = [
  { plan: 'free', messagesPerDay: 10, maxOutputTokens: 600 },
  { plan: 'pro', messagesPerDay: 200, maxOutputTokens: 2000 },
]

export const seedApps: RelayApp[] = [
  {
    id: 'app_luna',
    name: 'Luna Stories',
    slug: 'luna-stories',
    emoji: '🌙',
    status: 'live',
    provider: 'anthropic',
    model: 'claude-sonnet-5-5',
    temperature: 0.9,
    webhookUrl: 'https://abc123.lambda-url.ap-south-1.on.aws/relay/webhook',
    signingSecret: 'rls_live_8f2a91c0d4e7b35a6f19c2e0',
    activeVersion: 3,
    prompts: [
      {
        version: 3,
        note: 'Shorter stories, gentler endings',
        createdAt: daysAgo(2),
        content:
          'You are Luna, a warm bedtime storyteller for children aged 3–8.\n\n- Keep stories under 400 words.\n- Always end calmly, with the main character falling asleep.\n- Never include scary villains, violence, or peril.\n- Use the child\'s name ({{child_name}}) and favourite animal ({{favorite_animal}}) when provided.',
      },
      {
        version: 2,
        note: 'Added personalisation variables',
        createdAt: daysAgo(9),
        content:
          'You are Luna, a bedtime storyteller for young children.\n\nUse the child\'s name ({{child_name}}) when provided. Keep stories under 600 words and avoid anything scary.',
      },
      {
        version: 1,
        note: 'Initial prompt',
        createdAt: daysAgo(30),
        content: 'You are a bedtime storyteller. Write short, calming stories for kids.',
      },
    ],
    limits: [
      { plan: 'free', messagesPerDay: 3, maxOutputTokens: 800 },
      { plan: 'pro', messagesPerDay: 50, maxOutputTokens: 1500 },
    ],
    stats: { requests24h: 4820, tokens24h: 3_910_000, cost24h: 41.2, p50LatencyMs: 410, errorRate: 0.004 },
    createdAt: daysAgo(30),
  },
  {
    id: 'app_roast',
    name: 'Roast Bot',
    slug: 'roast-bot',
    emoji: '🔥',
    status: 'live',
    provider: 'anthropic',
    model: 'claude-haiku-5-5',
    temperature: 1,
    webhookUrl: 'https://def456.lambda-url.ap-south-1.on.aws/relay/webhook',
    signingSecret: 'rls_live_1c9e7d33a0b84f2296aa71fe',
    activeVersion: 2,
    prompts: [
      {
        version: 2,
        note: 'Tone down, no appearance roasts',
        createdAt: daysAgo(4),
        content:
          'You are Roast Bot. Deliver a playful, witty roast of the user based on what they tell you about themselves.\n\nRules:\n- Punch up, never down. No jokes about appearance, race, gender, religion, disability or weight.\n- 3–5 sentences max.\n- End with one genuine compliment.',
      },
      {
        version: 1,
        note: 'Initial prompt',
        createdAt: daysAgo(21),
        content: 'You are Roast Bot. Roast the user hard but keep it funny.',
      },
    ],
    limits: defaultLimits,
    stats: { requests24h: 12_400, tokens24h: 2_480_000, cost24h: 7.9, p50LatencyMs: 230, errorRate: 0.011 },
    createdAt: daysAgo(21),
  },
  {
    id: 'app_puff',
    name: 'Puff Logger',
    slug: 'puff-logger',
    emoji: '💨',
    status: 'live',
    provider: 'anthropic',
    model: 'claude-sonnet-5-5',
    temperature: 0.6,
    webhookUrl: 'https://ghi789.lambda-url.ap-south-1.on.aws/relay/webhook',
    signingSecret: 'rls_live_77b0e2f9c41a5d8e03b6c9a1',
    activeVersion: 1,
    prompts: [
      {
        version: 1,
        note: 'Quit coach v1',
        createdAt: daysAgo(12),
        content:
          'You are a supportive, non-judgmental quit-vaping coach. You can see the user\'s recent puff log summary in {{puff_summary}}.\n\nCelebrate progress, suggest one small concrete step, and never shame relapses.',
      },
    ],
    limits: defaultLimits,
    stats: { requests24h: 1310, tokens24h: 980_000, cost24h: 9.6, p50LatencyMs: 380, errorRate: 0.002 },
    createdAt: daysAgo(12),
  },
  {
    id: 'app_lift',
    name: 'LiftArc',
    slug: 'liftarc',
    emoji: '🏋️',
    status: 'paused',
    provider: 'openai',
    model: 'gpt-5-mini',
    temperature: 0.4,
    webhookUrl: 'https://jkl012.lambda-url.ap-south-1.on.aws/relay/webhook',
    signingSecret: 'rls_live_e3d5a8f1b2c7094e6a1d3f58',
    activeVersion: 1,
    prompts: [
      {
        version: 1,
        note: 'Workout suggestions',
        createdAt: daysAgo(6),
        content:
          'You are a strength coach. Given the user\'s last 5 workouts ({{recent_workouts}}), suggest today\'s session with sets, reps and target weights. Be concise and use a table.',
      },
    ],
    limits: defaultLimits,
    stats: { requests24h: 0, tokens24h: 0, cost24h: 0, p50LatencyMs: 0, errorRate: 0 },
    createdAt: daysAgo(6),
  },
  {
    id: 'app_pool',
    name: 'PoolCare',
    slug: 'poolcare',
    emoji: '🏊',
    status: 'live',
    provider: 'google',
    model: 'gemini-2.5-flash',
    temperature: 0.3,
    webhookUrl: 'https://mno345.lambda-url.ap-south-1.on.aws/relay/webhook',
    signingSecret: 'rls_live_4a6c8e0f2b1d3957a8c6e4f2',
    activeVersion: 1,
    prompts: [
      {
        version: 1,
        note: 'Water chemistry helper',
        createdAt: daysAgo(1),
        content:
          'You are a pool maintenance expert. Given test strip readings ({{readings}}) and pool volume ({{volume_gallons}}), explain what is off and exactly how much of each chemical to add. Always include a safety note.',
      },
    ],
    limits: defaultLimits,
    stats: { requests24h: 640, tokens24h: 410_000, cost24h: 0.9, p50LatencyMs: 290, errorRate: 0.0 },
    createdAt: daysAgo(1),
  },
]

// Hourly request counts for the last 24h, per app (deterministic pseudo-random)
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

export function hourlySeries(apps: RelayApp[]) {
  const r = rng(42)
  return Array.from({ length: 24 }, (_, i) => {
    const hour = new Date(now - (23 - i) * 3_600_000).getHours()
    // evening peak for consumer apps
    const curve = 0.35 + 0.65 * Math.exp(-((hour - 21) ** 2) / 18)
    const byApp: Record<string, number> = {}
    for (const a of apps) {
      byApp[a.id] = Math.round((a.stats.requests24h / 24) * curve * (0.7 + r() * 0.6) * 1.6)
    }
    return { hour, byApp }
  })
}

const STATUSES: LogStatus[] = ['ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'rate_limited', 'error', 'aborted']

export function seedLogs(apps: RelayApp[]): LogEntry[] {
  const r = rng(7)
  const live = apps.filter((a) => a.status === 'live')
  return Array.from({ length: 120 }, (_, i) => {
    const app = live[Math.floor(r() * live.length)]
    const status = STATUSES[Math.floor(r() * STATUSES.length)]
    const plan = r() > 0.8 ? 'pro' : 'free'
    const inputTokens = Math.round(200 + r() * 1400)
    const outputTokens = status === 'ok' ? Math.round(80 + r() * 700) : status === 'aborted' ? Math.round(r() * 120) : 0
    const [pi, po] = PRICING[app.model] ?? [1, 5]
    return {
      id: `req_${(0x1a2b3c + i * 7919).toString(16)}`,
      appId: app.id,
      userId: `usr_${Math.floor(r() * 9000 + 1000)}`,
      plan,
      model: app.model,
      status,
      inputTokens: status === 'rate_limited' ? 0 : inputTokens,
      outputTokens,
      ttftMs: status === 'rate_limited' ? 0 : Math.round(150 + r() * 600),
      durationMs: status === 'rate_limited' ? 4 : Math.round(900 + r() * 7000),
      cost: status === 'rate_limited' ? 0 : (inputTokens * pi + outputTokens * po) / 1_000_000,
      promptVersion: app.activeVersion,
      at: new Date(now - i * (40_000 + r() * 400_000)).toISOString(),
    }
  })
}

export const seedProviderKeys: Record<Provider, string> = {
  anthropic: 'sk-ant-api03-Xk2v9QpLmN4rT8wZ1bYc',
  openai: 'sk-proj-7Hd3kLqP2mVn9xRt4sWz',
  google: '',
}

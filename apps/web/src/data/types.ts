export type Provider = 'anthropic' | 'openai' | 'google'

export type AppStatus = 'live' | 'paused'

export type PromptVersion = {
  version: number
  content: string
  note: string
  createdAt: string
}

export type PlanLimit = {
  plan: string
  messagesPerDay: number
  maxOutputTokens: number
}

export type RelayApp = {
  id: string
  name: string
  slug: string
  emoji: string
  status: AppStatus
  provider: Provider
  model: string
  temperature: number
  webhookUrl: string
  signingSecret: string
  activeVersion: number
  prompts: PromptVersion[]
  limits: PlanLimit[]
  stats: {
    requests24h: number
    tokens24h: number
    cost24h: number
    p50LatencyMs: number
    errorRate: number
  }
  createdAt: string
}

export type LogStatus = 'ok' | 'error' | 'rate_limited' | 'aborted'

export type LogEntry = {
  id: string
  appId: string
  userId: string
  plan: string
  model: string
  status: LogStatus
  inputTokens: number
  outputTokens: number
  ttftMs: number
  durationMs: number
  cost: number
  promptVersion: number
  at: string
}

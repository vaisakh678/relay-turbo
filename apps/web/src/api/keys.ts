import type { RequestStatus, TokenKind } from '@repo/dto'

// One place for every query key, so mutations invalidate exactly what they touch.
export const keys = {
  apps: () => ['apps'] as const,
  app: (id: string) => ['apps', id] as const,
  testTokens: (appId: string) => ['apps', appId, 'test-tokens'] as const,
  providerKeys: () => ['provider-keys'] as const,
  logs: (filters: LogFilters = {}) => ['logs', filters] as const,
  stats: (hours: number) => ['stats', hours] as const,
  timeseries: (hours: number) => ['timeseries', hours] as const,
}

export type LogFilters = { appId?: string; status?: RequestStatus; tokenKind?: TokenKind }

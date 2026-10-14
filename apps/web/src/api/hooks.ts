import type {
  AppDetailDTO,
  AppDTO,
  AppStatsDTO,
  CreatedTestTokenDTO,
  LogPageDTO,
  PlanLimitDTO,
  PlaygroundTokenDTO,
  PromptVersionDTO,
  Provider,
  ProviderKeyDTO,
  TestTokenDTO,
  TimeseriesPointDTO,
} from '@repo/dto'
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from './client'
import { keys, type LogFilters } from './keys'

// ---------- Apps ----------

export const useApps = () => useQuery({ queryKey: keys.apps(), queryFn: () => api<AppDTO[]>('/apps') })

export const useApp = (id: string) =>
  useQuery({ queryKey: keys.app(id), queryFn: () => api<AppDetailDTO>(`/apps/${id}`), enabled: !!id })

export type CreateAppInput = Pick<AppDTO, 'name' | 'emoji' | 'provider' | 'model'> & { systemPrompt?: string }

export function useCreateApp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateAppInput) => api<AppDetailDTO>('/apps', { method: 'POST', json: input }),
    onSuccess: (app) => {
      qc.setQueryData(keys.app(app.id), app)
      return qc.invalidateQueries({ queryKey: keys.apps() })
    },
  })
}

export type UpdateAppInput = Partial<
  Pick<AppDTO, 'name' | 'emoji' | 'status' | 'provider' | 'model' | 'temperature' | 'webhookUrl' | 'allowTestTokens'>
>

/** Optimistic: the dashboard flips toggles/selects instantly and rolls back on error. */
export function useUpdateApp(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: UpdateAppInput) => api<AppDTO>(`/apps/${id}`, { method: 'PATCH', json: patch }),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: keys.app(id) })
      const previous = qc.getQueryData<AppDetailDTO>(keys.app(id))
      if (previous) qc.setQueryData<AppDetailDTO>(keys.app(id), { ...previous, ...patch })
      return { previous }
    },
    onError: (_err, _patch, ctx) => {
      if (ctx?.previous) qc.setQueryData(keys.app(id), ctx.previous)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.apps() }),
  })
}

export function usePublishPrompt(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { content: string; note?: string }) =>
      api<PromptVersionDTO>(`/apps/${id}/prompts`, { method: 'POST', json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.app(id) }),
  })
}

export function useActivateVersion(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (version: number) => api(`/apps/${id}/prompts/${version}/activate`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.apps() }),
  })
}

export function useReplaceLimits(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (limits: PlanLimitDTO[]) => api<PlanLimitDTO[]>(`/apps/${id}/limits`, { method: 'PUT', json: { limits } }),
    onSuccess: (limits) =>
      qc.setQueryData<AppDetailDTO>(keys.app(id), (prev) => (prev ? { ...prev, limits } : prev)),
  })
}

/** The full secret is never cached in the query client; fetched on demand. */
export const fetchSigningSecret = (id: string) =>
  api<{ signingSecret: string }>(`/apps/${id}/secret`).then((r) => r.signingSecret)

export function useRotateSecret(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api<{ signingSecret: string }>(`/apps/${id}/secret/rotate`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.app(id) }),
  })
}

// ---------- Tokens ----------

export const useTestTokens = (appId: string) =>
  useQuery({ queryKey: keys.testTokens(appId), queryFn: () => api<TestTokenDTO[]>(`/apps/${appId}/test-tokens`) })

export type CreateTestTokenInput = {
  label: string
  user: string
  plan: string
  vars: Record<string, string>
  expiresIn: '1h' | '1d' | '7d'
}

export function useCreateTestToken(appId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateTestTokenInput) =>
      api<CreatedTestTokenDTO>(`/apps/${appId}/test-tokens`, { method: 'POST', json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.testTokens(appId) }),
  })
}

export function useRevokeTestToken(appId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (tokenId: string) => api<TestTokenDTO>(`/apps/${appId}/test-tokens/${tokenId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.testTokens(appId) }),
  })
}

/** Short-lived token for the Playground; minted per conversation settings, not cached by the query client. */
export const fetchPlaygroundToken = (appId: string, input: { user: string; plan: string; vars: Record<string, string> }) =>
  api<PlaygroundTokenDTO>(`/apps/${appId}/playground-token`, { method: 'POST', json: input })

// ---------- Provider keys ----------

export const useProviderKeys = () =>
  useQuery({ queryKey: keys.providerKeys(), queryFn: () => api<ProviderKeyDTO[]>('/provider-keys') })

export function useSetProviderKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ provider, apiKey }: { provider: Provider; apiKey: string }) =>
      api<ProviderKeyDTO>(`/provider-keys/${provider}`, { method: 'PUT', json: { apiKey } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.providerKeys() }),
  })
}

export function useDeleteProviderKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (provider: Provider) => api(`/provider-keys/${provider}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.providerKeys() }),
  })
}

// ---------- Logs & stats ----------

export function useLogs(filters: LogFilters = {}, pageSize = 50) {
  return useInfiniteQuery({
    queryKey: keys.logs(filters),
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(pageSize) })
      if (filters.appId) params.set('appId', filters.appId)
      if (filters.status) params.set('status', filters.status)
      if (filters.tokenKind) params.set('tokenKind', filters.tokenKind)
      if (pageParam) params.set('cursor', pageParam)
      return api<LogPageDTO>(`/logs?${params}`)
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  })
}

/** One page of logs. `cursor` is the last ID of the previous page (undefined = first page). */
export function useLogsPage(filters: LogFilters, cursor: string | undefined, pageSize: number) {
  return useQuery({
    queryKey: [...keys.logs(filters), 'page', cursor ?? null, pageSize] as const,
    queryFn: () => {
      const params = new URLSearchParams({ limit: String(pageSize) })
      if (filters.appId) params.set('appId', filters.appId)
      if (filters.status) params.set('status', filters.status)
      if (filters.tokenKind) params.set('tokenKind', filters.tokenKind)
      if (cursor) params.set('cursor', cursor)
      return api<LogPageDTO>(`/logs?${params}`)
    },
    // Keep showing the current page while the next one loads
    placeholderData: keepPreviousData,
  })
}

const LIVE = { refetchInterval: 30_000 } as const

export const useStats = (hours = 24) =>
  useQuery({ queryKey: keys.stats(hours), queryFn: () => api<AppStatsDTO[]>(`/logs/stats?hours=${hours}`), ...LIVE })

export const useTimeseries = (hours = 24) =>
  useQuery({
    queryKey: keys.timeseries(hours),
    queryFn: () => api<TimeseriesPointDTO[]>(`/logs/timeseries?hours=${hours}`),
    ...LIVE,
  })

export const useHealth = () =>
  useQuery({
    queryKey: ['health'],
    queryFn: () => api<{ status: string; uptime: number }>('/health'),
    refetchInterval: 30_000,
    retry: false,
  })

export function useDeleteApp(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api<{ id: string }>(`/apps/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.removeQueries({ queryKey: keys.app(id) })
      return qc.invalidateQueries({ queryKey: keys.apps() })
    },
  })
}

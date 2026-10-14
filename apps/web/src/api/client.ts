import type { APIResponse } from '@repo/dto'

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api/v1'
/** Gateway origin, for the SDK (which appends /api/v1/chat itself). */
export const API_ORIGIN = API_URL.replace(/\/api\/v1\/?$/, '')

export class ApiError extends Error {
  readonly status: number
  readonly meta?: Record<string, unknown>

  constructor(status: number, message: string, meta?: Record<string, unknown>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.meta = meta
  }
}

/** fetch + unwrap the API's `{ data, error }` envelope; non-2xx throws ApiError. */
export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {}
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...rest,
      // Dashboard routes are authenticated by the Better Auth session cookie
      credentials: 'include',
      headers: { ...(json !== undefined && { 'Content-Type': 'application/json' }), ...rest.headers },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    })
  } catch {
    throw new ApiError(0, `Can't reach the Relay API at ${API_URL}. Is it running?`)
  }
  const body = (await res.json().catch(() => null)) as APIResponse<T, Record<string, unknown>> | null
  if (!res.ok || !body) throw new ApiError(res.status, body?.error ?? `Request failed (${res.status})`, body?.meta)
  return body.data
}

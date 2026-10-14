export type TokenSource = string | (() => string | Promise<string>)

// Refresh a little early so a token never expires mid-request.
const REFRESH_MARGIN_MS = 30_000

/** Read `exp` from a JWT without verifying it (the gateway verifies). */
export function jwtExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '='))
    const exp = (JSON.parse(json) as { exp?: unknown }).exp
    return typeof exp === 'number' ? exp * 1000 : null
  } catch {
    return null
  }
}

/**
 * Caches the token from a getter until shortly before it expires. Concurrent
 * callers share one in-flight fetch, so N parallel streams cause one call to
 * your backend, not N.
 */
export class TokenManager {
  private cached: { token: string; expiresAt: number | null } | null = null
  private inflight: Promise<string> | null = null
  private readonly source: TokenSource

  constructor(source: TokenSource) {
    this.source = source
  }

  /** A static token can't be refreshed; a 401 with one is final. */
  get refreshable(): boolean {
    return typeof this.source === 'function'
  }

  async get(forceRefresh = false): Promise<string> {
    if (typeof this.source === 'string') return this.source
    const c = this.cached
    if (!forceRefresh && c && (c.expiresAt === null || c.expiresAt - Date.now() > REFRESH_MARGIN_MS)) return c.token
    if (!this.inflight) {
      const getter = this.source
      this.inflight = Promise.resolve()
        .then(getter)
        .then((token) => {
          if (typeof token !== 'string' || !token) throw new TypeError('Relay token getter must return a non-empty string')
          this.cached = { token, expiresAt: jwtExpiry(token) }
          return token
        })
        .finally(() => {
          this.inflight = null
        })
    }
    return this.inflight
  }
}

/** Base class for everything the SDK throws. `status` is the HTTP status (0 = no response). */
export class RelayError extends Error {
  readonly status: number
  readonly code: string

  constructor(message: string, status = 0, code = 'relay_error') {
    super(message)
    this.name = new.target.name
    this.status = status
    this.code = code
  }
}

/** 401: missing, invalid, expired or revoked token (after one automatic refresh). */
export class AuthError extends RelayError {}

/** 403: app paused, or test tokens disabled for the app. */
export class ForbiddenError extends RelayError {}

/** 400: the request was rejected as invalid. */
export class ValidationError extends RelayError {}

/** 429: the user hit their plan's daily limit (`rate_limited`) or the app's test-token cap (`test_cap`). */
export class RateLimitError extends RelayError {
  readonly limit?: number
  readonly used?: number
  /** When the daily limit resets (start of the next UTC day). */
  readonly resetAt?: Date

  constructor(message: string, meta: { code?: string; limit?: number; used?: number; resetAt?: string } = {}) {
    super(message, 429, meta.code ?? 'rate_limited')
    this.limit = meta.limit
    this.used = meta.used
    this.resetAt = meta.resetAt ? new Date(meta.resetAt) : undefined
  }
}

/** 5xx: the gateway couldn't serve the request (e.g. no provider key configured). */
export class ServerError extends RelayError {}

/** The request never got a response (offline, DNS, CORS, ...). */
export class NetworkError extends RelayError {}

/** The stream started but failed part-way: the model provider errored or the connection dropped. */
export class StreamError extends RelayError {}

/** The caller aborted the stream. */
export class AbortError extends RelayError {
  constructor() {
    super('The stream was aborted', 0, 'aborted')
  }
}

/** Map a non-2xx JSON response (`{ error, meta }`) to the right error class. */
export function errorFromResponse(status: number, body: { error?: string; meta?: Record<string, unknown> } | null): RelayError {
  const message = body?.error ?? `Request failed with status ${status}`
  const meta = body?.meta ?? {}
  if (status === 401) return new AuthError(message, status, 'unauthorized')
  if (status === 403) return new ForbiddenError(message, status, 'forbidden')
  if (status === 429) return new RateLimitError(message, meta as ConstructorParameters<typeof RateLimitError>[1])
  if (status === 400) return new ValidationError(message, status, 'invalid_request')
  if (status >= 500) return new ServerError(message, status, 'server_error')
  return new RelayError(message, status)
}

import { AbortError, AuthError, errorFromResponse, NetworkError, RelayError, StreamError } from './errors'
import { parseSse } from './sse'
import { RelayStream } from './stream'
import { TokenManager, type TokenSource } from './token'
import type { StreamCallbacks, StreamEvent, StreamInput, StreamResult } from './types'

export type RelayOptions = {
  /** Gateway origin, e.g. "https://api.sse-relay.com" or "http://localhost:3001". */
  baseUrl: string
  /**
   * A chat token, or a function that fetches one from your backend. With a
   * function, tokens are cached until shortly before they expire and
   * refreshed automatically (once) when the gateway rejects one.
   */
  token: TokenSource
  /**
   * Custom fetch. Required on React Native, whose built-in fetch can't stream
   * response bodies (use e.g. `fetch` from "expo/fetch").
   */
  fetch?: typeof fetch
  /** Extra headers on every request. */
  headers?: Record<string, string>
  /**
   * Retries for failures *before* the stream starts (network errors, 502, 504).
   * Never retried once text has arrived, which would duplicate output and cost. Default 2.
   */
  retries?: number
}

export type Relay = {
  /** Start streaming a reply. Returns immediately; see RelayStream for ways to consume it. */
  stream(input: StreamInput, callbacks?: StreamCallbacks): RelayStream
  /** Stream to completion and return the full result. */
  complete(input: StreamInput): Promise<StreamResult>
}

const RETRYABLE_STATUS = new Set([502, 504])

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new AbortError())
    const t = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => (clearTimeout(t), reject(new AbortError())), { once: true })
  })
}

export function createRelay(options: RelayOptions): Relay {
  const url = `${options.baseUrl.replace(/\/+$/, '')}/api/v1/chat`
  const fetchImpl = options.fetch ?? globalThis.fetch?.bind(globalThis)
  if (!fetchImpl) throw new RelayError('No fetch implementation available; pass `fetch` in createRelay options')
  const retries = options.retries ?? 2
  const tokens = new TokenManager(options.token)

  async function getToken(force = false) {
    try {
      return await tokens.get(force)
    } catch (err) {
      const error = new AuthError(`Couldn't get a Relay token: ${err instanceof Error ? err.message : String(err)}`, 0, 'token_getter_failed')
      ;(error as Error & { cause?: unknown }).cause = err
      throw error
    }
  }

  /** POST until we have a 2xx streaming response, handling token refresh and pre-stream retries. */
  async function open(input: StreamInput, signal: AbortSignal): Promise<Response> {
    const body = JSON.stringify({ messages: input.messages, vars: input.vars ?? {} })
    let refreshed = false
    let attempt = 0

    for (;;) {
      const token = await getToken()
      let res: Response
      try {
        res = await fetchImpl(url, {
          method: 'POST',
          headers: {
            ...options.headers,
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            Authorization: `Bearer ${token}`,
          },
          body,
          signal,
        })
      } catch (err) {
        if (signal.aborted) throw new AbortError()
        if (attempt < retries) {
          await sleep(300 * 2 ** attempt++ + Math.random() * 100, signal)
          continue
        }
        throw new NetworkError(`Couldn't reach Relay at ${url}: ${err instanceof Error ? err.message : String(err)}`)
      }

      if (res.ok) return res

      if (res.status === 401 && tokens.refreshable && !refreshed) {
        refreshed = true
        await getToken(true)
        continue
      }
      if (RETRYABLE_STATUS.has(res.status) && attempt < retries) {
        await sleep(300 * 2 ** attempt++ + Math.random() * 100, signal)
        continue
      }
      const errBody = (await res.json().catch(() => null)) as { error?: string; meta?: Record<string, unknown> } | null
      throw errorFromResponse(res.status, errBody)
    }
  }

  async function* produce(input: StreamInput, signal: AbortSignal): AsyncGenerator<StreamEvent> {
    const res = await open(input, signal)
    if (!res.body) {
      throw new RelayError(
        'The response body is not streamable. On React Native, pass a streaming fetch (e.g. from "expo/fetch") to createRelay.',
        res.status,
        'not_streamable',
      )
    }

    for await (const { event, data } of parseSse(res.body, signal)) {
      let payload: Record<string, unknown>
      try {
        payload = JSON.parse(data) as Record<string, unknown>
      } catch {
        throw new StreamError(`Malformed "${event}" event from the gateway`, res.status, 'malformed_event')
      }
      switch (event) {
        case 'start':
          yield { type: 'start', id: String(payload.id), model: String(payload.model), promptVersion: Number(payload.promptVersion) }
          break
        case 'delta':
          yield { type: 'delta', text: String(payload.text ?? '') }
          break
        case 'usage':
          yield { type: 'usage', usage: { input: Number(payload.input ?? 0), output: Number(payload.output ?? 0) } }
          break
        case 'done':
          yield { type: 'done', finishReason: String(payload.finishReason ?? 'stop') }
          return
        case 'error':
          throw new StreamError(String(payload.message ?? 'Stream failed'), res.status, String(payload.code ?? 'stream_error'))
        // Unknown events are ignored so older SDKs keep working with newer gateways.
      }
    }
  }

  return {
    stream: (input, callbacks) => new RelayStream((signal) => produce(input, signal), callbacks, input.signal),
    complete: (input) => new RelayStream((signal) => produce(input, signal), {}, input.signal).final,
  }
}

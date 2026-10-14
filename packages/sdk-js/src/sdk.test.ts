import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { AbortError, AuthError, createRelay, NetworkError, RateLimitError, RelayError, StreamError } from './index'
import { parseSse } from './sse'
import { jwtExpiry, TokenManager } from './token'

// ---------- helpers ----------

const enc = new TextEncoder()

/** A ReadableStream that emits the given chunks, optionally with a delay between them. */
function bodyOf(chunks: (string | Uint8Array)[], delayMs = 0): ReadableStream<Uint8Array> {
  let i = 0
  return new ReadableStream({
    async pull(controller) {
      if (i >= chunks.length) return controller.close()
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs))
      const c = chunks[i++]!
      controller.enqueue(typeof c === 'string' ? enc.encode(c) : c)
    },
  })
}

const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`

const HAPPY = [
  sse('start', { id: 'req_1', model: 'claude-haiku-5-5', promptVersion: 3 }),
  ': ping\n\n',
  sse('delta', { text: 'Once upon ' }),
  sse('delta', { text: 'a time.' }),
  sse('usage', { input: 12, output: 4 }),
  sse('done', { finishReason: 'stop' }),
]

type Call = { url: string; init: RequestInit }

/** Fake fetch: each call takes the next handler. Records calls. */
function fakeFetch(...handlers: ((call: Call) => Response | Promise<Response>)[]) {
  const calls: Call[] = []
  const fn = (async (url: string, init: RequestInit) => {
    const call = { url, init }
    calls.push(call)
    const handler = handlers[Math.min(calls.length - 1, handlers.length - 1)]!
    return handler(call)
  }) as unknown as typeof fetch
  return { fetch: fn, calls }
}

const streamResponse = (chunks: string[], delayMs = 0) => () =>
  new Response(bodyOf(chunks, delayMs), { status: 200, headers: { 'Content-Type': 'text/event-stream' } })

const jsonResponse = (status: number, body: unknown) => () =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const authOf = (c: Call) => (c.init.headers as Record<string, string>).Authorization

function jwt(expSecondsFromNow: number) {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'HS256' })}.${b64({ exp: Math.floor(Date.now() / 1000) + expSecondsFromNow, n: Math.random() })}.sig`
}

const input = { messages: [{ role: 'user' as const, content: 'hi' }] }

// ---------- SSE parser ----------

describe('parseSse', () => {
  const collect = async (chunks: (string | Uint8Array)[]) => {
    const out = []
    for await (const m of parseSse(bodyOf(chunks))) out.push(m)
    return out
  }

  test('events split at arbitrary points, CRLF, comments, multi-line data, missing final blank line', async () => {
    const out = await collect(['event: a\r\nda', 'ta: 1\r\n\r\n: ping\n\n', 'event: b\ndata: x\ndata: y\n\n', 'event: c\ndata: z'])
    assert.deepEqual(out, [
      { event: 'a', data: '1' },
      { event: 'b', data: 'x\ny' },
      { event: 'c', data: 'z' },
    ])
  })

  test('multi-byte characters split across chunks', async () => {
    const bytes = enc.encode(sse('delta', { text: 'héllo 🌙' }))
    const cut = bytes.indexOf(0xf0) + 2 // middle of the 4-byte emoji
    const out = await collect([bytes.slice(0, cut), bytes.slice(cut)])
    assert.equal(JSON.parse(out[0]!.data).text, 'héllo 🌙')
  })
})

// ---------- tokens ----------

describe('TokenManager', () => {
  test('reads exp from a JWT', () => {
    const exp = jwtExpiry(jwt(60))!
    assert.ok(Math.abs(exp - (Date.now() + 60_000)) < 2000)
    assert.equal(jwtExpiry('not-a-jwt'), null)
  })

  test('concurrent callers share one fetch; near-expiry tokens are refreshed', async () => {
    let calls = 0
    const tm = new TokenManager(async () => {
      calls++
      await new Promise((r) => setTimeout(r, 10))
      return calls === 1 ? jwt(10) : jwt(3600) // first token is inside the 30s refresh margin
    })
    const [a, b, c] = await Promise.all([tm.get(), tm.get(), tm.get()])
    assert.equal(calls, 1)
    assert.ok(a === b && b === c)
    const d = await tm.get()
    assert.equal(calls, 2, 'refreshes a token that expires within 30s')
    assert.equal(await tm.get(), d, 'then serves the fresh one from cache')
    assert.equal(calls, 2)
  })
})

// ---------- client ----------

describe('createRelay', () => {
  test('iterates typed events; final, callbacks and headers line up', async () => {
    const f = fakeFetch(streamResponse(HAPPY))
    const relay = createRelay({ baseUrl: 'http://relay.test/', token: 'tok_static', fetch: f.fetch })
    const deltas: string[] = []
    let done: unknown
    const stream = relay.stream(
      { ...input, vars: { name: 'Mia' } },
      { onDelta: (_t, snap) => deltas.push(snap), onDone: (r) => (done = r) },
    )

    const types = []
    for await (const e of stream) types.push(e.type)
    assert.deepEqual(types, ['start', 'delta', 'delta', 'usage', 'done'])

    const final = await stream.final
    assert.deepEqual(final, {
      id: 'req_1',
      model: 'claude-haiku-5-5',
      promptVersion: 3,
      text: 'Once upon a time.',
      usage: { input: 12, output: 4 },
      finishReason: 'stop',
    })
    assert.deepEqual(deltas, ['Once upon ', 'Once upon a time.'])
    assert.deepEqual(done, final)

    assert.equal(f.calls[0]!.url, 'http://relay.test/api/v1/chat')
    assert.equal(authOf(f.calls[0]!), 'Bearer tok_static')
    assert.deepEqual(JSON.parse(f.calls[0]!.init.body as string), { ...input, vars: { name: 'Mia' } })
  })

  test('textStream and complete()', async () => {
    const relay = createRelay({ baseUrl: 'http://relay.test', token: 't', fetch: fakeFetch(streamResponse(HAPPY), streamResponse(HAPPY)).fetch })
    let text = ''
    for await (const t of relay.stream(input).textStream) text += t
    assert.equal(text, 'Once upon a time.')
    assert.equal((await relay.complete(input)).text, 'Once upon a time.')
  })

  test('401 → refreshes the token once and retries', async () => {
    let n = 0
    const f = fakeFetch(jsonResponse(401, { data: null, error: 'Token expired' }), streamResponse(HAPPY))
    const relay = createRelay({ baseUrl: 'http://relay.test', token: () => `tok_${++n}`, fetch: f.fetch })
    assert.equal((await relay.complete(input)).text, 'Once upon a time.')
    assert.deepEqual(f.calls.map(authOf), ['Bearer tok_1', 'Bearer tok_2'])
  })

  test('401 with a static token, or twice in a row → AuthError', async () => {
    const static401 = createRelay({ baseUrl: 'http://x', token: 't', fetch: fakeFetch(jsonResponse(401, { error: 'Token revoked' })).fetch })
    await assert.rejects(static401.complete(input), (e) => e instanceof AuthError && e.message === 'Token revoked')

    const f = fakeFetch(jsonResponse(401, { error: 'Invalid token' }))
    const refreshing = createRelay({ baseUrl: 'http://x', token: () => 't', fetch: f.fetch })
    await assert.rejects(refreshing.complete(input), AuthError)
    assert.equal(f.calls.length, 2, 'only one refresh attempt')
  })

  test('429 → RateLimitError with code, limit and resetAt', async () => {
    const relay = createRelay({
      baseUrl: 'http://x',
      token: 't',
      fetch: fakeFetch(
        jsonResponse(429, {
          data: null,
          error: 'Daily message limit reached for plan "free"',
          meta: { code: 'rate_limited', limit: 3, used: 3, resetAt: '2026-10-15T00:00:00.000Z' },
        }),
      ).fetch,
    })
    const err = await relay.complete(input).catch((e: unknown) => e)
    assert.ok(err instanceof RateLimitError)
    assert.equal(err.code, 'rate_limited')
    assert.equal(err.limit, 3)
    assert.equal(err.resetAt?.toISOString(), '2026-10-15T00:00:00.000Z')
  })

  test('network failure before the stream → retried, then NetworkError', async () => {
    const down = () => Promise.reject(new TypeError('fetch failed'))
    const recovers = fakeFetch(down, streamResponse(HAPPY))
    assert.equal((await createRelay({ baseUrl: 'http://x', token: 't', fetch: recovers.fetch }).complete(input)).text, 'Once upon a time.')
    assert.equal(recovers.calls.length, 2)

    const never = fakeFetch(down)
    await assert.rejects(createRelay({ baseUrl: 'http://x', token: 't', fetch: never.fetch, retries: 1 }).complete(input), NetworkError)
    assert.equal(never.calls.length, 2)
  })

  test('error event mid-stream → StreamError, text so far is kept', async () => {
    const f = fakeFetch(
      streamResponse([HAPPY[0]!, HAPPY[2]!, sse('error', { code: 'upstream_error', message: 'The model provider returned an error' })]),
    )
    const relay = createRelay({ baseUrl: 'http://x', token: 't', fetch: f.fetch, retries: 3 })
    let snapshot = ''
    let errored: unknown
    const stream = relay.stream(input, { onDelta: (_t, s) => (snapshot = s), onError: (e) => (errored = e) })
    await assert.rejects(stream.final, (e) => e instanceof StreamError && e.code === 'upstream_error')
    assert.equal(snapshot, 'Once upon ')
    assert.ok(errored instanceof StreamError)
    assert.equal(f.calls.length, 1, 'never retried after the stream started')
  })

  test('abort mid-stream → AbortError and the request is cancelled', async () => {
    const f = fakeFetch(streamResponse(HAPPY, 30))
    const stream = createRelay({ baseUrl: 'http://x', token: 't', fetch: f.fetch }).stream(input, {
      onDelta: () => stream.abort(),
    })
    await assert.rejects(stream.final, AbortError)
    assert.equal((f.calls[0]!.init.signal as AbortSignal).aborted, true)
  })

  test('external AbortSignal works too', async () => {
    const controller = new AbortController()
    const stream = createRelay({ baseUrl: 'http://x', token: 't', fetch: fakeFetch(streamResponse(HAPPY, 30)).fetch }).stream({
      ...input,
      signal: controller.signal,
    })
    setTimeout(() => controller.abort(), 40)
    await assert.rejects(stream.final, AbortError)
  })

  test('stream that ends without `done` → StreamError', async () => {
    const relay = createRelay({ baseUrl: 'http://x', token: 't', fetch: fakeFetch(streamResponse(HAPPY.slice(0, 3))).fetch })
    await assert.rejects(relay.complete(input), (e) => e instanceof StreamError && e.code === 'incomplete_stream')
  })

  test('unknown events are ignored (forward compatible)', async () => {
    const relay = createRelay({ baseUrl: 'http://x', token: 't', fetch: fakeFetch(streamResponse([sse('tool_start', { name: 'x' }), ...HAPPY])).fetch })
    assert.equal((await relay.complete(input)).text, 'Once upon a time.')
  })

  test('non-streamable body (React Native fetch) → clear error', async () => {
    const relay = createRelay({ baseUrl: 'http://x', token: 't', fetch: fakeFetch(() => new Response(null, { status: 200 })).fetch })
    await assert.rejects(relay.complete(input), (e) => e instanceof RelayError && e.code === 'not_streamable')
  })

  test('a failing token getter → AuthError with the cause attached', async () => {
    const relay = createRelay({
      baseUrl: 'http://x',
      token: () => Promise.reject(new Error('backend down')),
      fetch: fakeFetch(streamResponse(HAPPY)).fetch,
    })
    await assert.rejects(relay.complete(input), (e) => e instanceof AuthError && /backend down/.test(e.message))
  })

  test('iterating twice throws', async () => {
    const stream = createRelay({ baseUrl: 'http://x', token: 't', fetch: fakeFetch(streamResponse(HAPPY)).fetch }).stream(input)
    for await (const _ of stream) void _
    await assert.rejects(async () => {
      for await (const _ of stream) void _
    }, RelayError)
  })
})

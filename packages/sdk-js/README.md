# @sse-relay/sdk

Stream AI replies from a [Relay](https://github.com/vaisakh678/relay-turbo) gateway. ~4 KB gzipped, zero dependencies, works in browsers, Node 18+, Bun, Deno and React Native.

```sh
npm i @sse-relay/sdk
```

## Quick start

```ts
import { createRelay } from '@sse-relay/sdk'

const relay = createRelay({
  baseUrl: 'https://your-relay.example.com',
  // A function that gets a token from your backend. Cached until shortly
  // before it expires, refreshed automatically if the gateway rejects it.
  token: () => fetch('/api/relay-token').then((r) => r.text()),
})

for await (const text of relay.stream({ messages }).textStream) {
  output.textContent += text
}
```

For local testing, pass a **test token** from the dashboard (Integration tab) as a plain string: `token: 'eyJhbGciOi…'`.

## Three ways to consume a stream

```ts
// 1. Typed events
const stream = relay.stream({ messages, vars: { child_name: 'Mia' } })
for await (const event of stream) {
  if (event.type === 'delta') append(event.text)
  if (event.type === 'usage') console.log(event.usage) // { input, output }
}

// 2. Callbacks
relay.stream({ messages }, {
  onDelta: (text, snapshot) => render(snapshot),
  onDone: (result) => save(result),
  onError: (error) => show(error),
})

// 3. Just the result
const { text, usage, id } = await relay.complete({ messages })
```

Every stream also has `stream.final` (a promise of the full result) and `stream.abort()`. Aborting cancels the model request on the gateway, so you stop paying for tokens nobody reads. You can also pass `signal` from an `AbortController`.

## Errors

Everything thrown is a `RelayError` with `status` and `code`:

| Class | When |
|---|---|
| `AuthError` | 401: missing, invalid, expired or revoked token (after one automatic refresh) |
| `ForbiddenError` | 403: app paused, or test tokens disabled |
| `RateLimitError` | 429: plan's daily limit (`code: 'rate_limited'`) or test-token cap (`'test_cap'`); has `limit`, `used`, `resetAt` |
| `ValidationError` | 400: invalid request |
| `ServerError` | 5xx: e.g. no provider key configured |
| `NetworkError` | No response (offline, DNS, CORS) |
| `StreamError` | Failed after streaming began (provider error, dropped connection) |
| `AbortError` | You called `abort()` |

```ts
try {
  await relay.complete({ messages })
} catch (err) {
  if (err instanceof RateLimitError) showPaywall(err.resetAt)
}
```

Failures **before** the stream starts (network errors, 502, 504) are retried with backoff (`retries`, default 2). Nothing is retried once text has arrived, since that would duplicate output and cost.

## React Native

React Native's built-in `fetch` can't stream response bodies. Pass a streaming one:

```ts
import { fetch } from 'expo/fetch'
const relay = createRelay({ baseUrl, token, fetch })
```

## Options

| Option | |
|---|---|
| `baseUrl` | Gateway origin (the SDK calls `POST {baseUrl}/api/v1/chat`) |
| `token` | `string`, or `() => string \| Promise<string>` |
| `fetch` | Custom fetch implementation |
| `headers` | Extra headers on every request |
| `retries` | Pre-stream retries, default `2` |

## License

MIT

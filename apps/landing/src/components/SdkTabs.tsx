"use client";

import { useState } from "react";

const SDKS = [
  {
    name: "TypeScript",
    file: "chat.ts",
    code: `import { Relay } from '@relay/sdk'

const relay = new Relay({
  app: 'luna-stories',
  // fetched from your Lambda, cached and refreshed for you
  token: () => api.get('/relay-token'),
})

for await (const e of relay.stream({ messages })) {
  if (e.type === 'delta') append(e.text)
  if (e.type === 'error' && e.code === 'rate_limited') showPaywall()
}`,
  },
  {
    name: "Swift",
    file: "ChatModel.swift",
    code: `import Relay

let relay = Relay(app: "luna-stories") {
    try await api.relayToken()
}

for try await event in relay.stream(messages: messages) {
    switch event {
    case .delta(let text): reply += text
    case .rateLimited(let resetAt): showPaywall(until: resetAt)
    default: break
    }
}`,
  },
  {
    name: "Kotlin",
    file: "ChatViewModel.kt",
    soon: true,
    code: `val relay = Relay(app = "luna-stories") { api.relayToken() }

relay.stream(messages).collect { event ->
    when (event) {
        is RelayEvent.Delta -> reply += event.text
        is RelayEvent.RateLimited -> showPaywall(event.resetAt)
        else -> Unit
    }
}`,
  },
  {
    name: "Lambda",
    file: "handler.ts",
    code: `import { createToken, verifyWebhook } from '@relay/server'

// 1. Mint a short-lived token for the signed-in user
export const token = async (user) =>
  createToken({ app: 'luna-stories', user: user.id, plan: user.plan })

// 2. Receive the finished message + token usage
export const webhook = async (req) => {
  const { message, usage } = await verifyWebhook(req)
  await db.messages.insert({ ...message, usage })
}`,
  },
];

export function SdkTabs() {
  const [active, setActive] = useState(0);
  const sdk = SDKS[active];

  return (
    <div className="overflow-hidden rounded-xl border border-line-strong bg-panel">
      <div className="flex overflow-x-auto border-b border-line">
        {SDKS.map((s, k) => (
          <button
            key={s.name}
            onClick={() => setActive(k)}
            className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-3 text-sm transition-colors ${
              active === k ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"
            }`}
          >
            {s.name}
            {s.soon && <span className="rounded bg-panel-2 px-1 text-[10px] text-faint">soon</span>}
          </button>
        ))}
        <span className="ml-auto hidden items-center pr-4 font-mono text-xs text-faint sm:flex">{sdk.file}</span>
      </div>
      <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed text-fg/90">{sdk.code}</pre>
    </div>
  );
}

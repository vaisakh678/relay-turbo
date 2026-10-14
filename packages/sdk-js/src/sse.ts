export type SseMessage = { event: string; data: string }

/**
 * Parse a text/event-stream body into messages. Handles CRLF, multi-line
 * data, comment lines (heartbeats) and chunks that split anywhere, including
 * inside a multi-byte character.
 */
export async function* parseSse(body: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<SseMessage> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const onAbort = () => void reader.cancel().catch(() => {})
  signal?.addEventListener('abort', onAbort, { once: true })

  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n?/g, '\n')

      let boundary: number
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        const message = parseBlock(block)
        if (message) yield message
      }
    }
    // A final event without the trailing blank line
    const tail = parseBlock((buffer + decoder.decode()).replace(/\r\n?/g, '\n'))
    if (tail) yield tail
  } finally {
    signal?.removeEventListener('abort', onAbort)
    reader.releaseLock()
  }
}

function parseBlock(block: string): SseMessage | null {
  let event = 'message'
  const data: string[] = []
  for (const line of block.split('\n')) {
    if (!line || line.startsWith(':')) continue // blank or comment (heartbeat)
    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    // Per spec, a single leading space after the colon is dropped
    const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '')
    if (field === 'event') event = value
    else if (field === 'data') data.push(value)
  }
  return data.length ? { event, data: data.join('\n') } : null
}

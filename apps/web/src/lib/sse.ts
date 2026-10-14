import type { RelayEvent } from '@repo/dto'

/**
 * Parse an SSE response body into Relay events. EventSource can't POST or
 * send headers, so chat streams are read from fetch() directly.
 */
export async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<RelayEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) return
    // stream: true keeps multi-byte characters intact across chunk boundaries
    buffer += decoder.decode(value, { stream: true })
    // Events are separated by a blank line
    let sep: number
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)
      let event = 'message'
      const data: string[] = []
      for (const line of raw.split('\n')) {
        if (line.startsWith(':')) continue // heartbeat comment
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) data.push(line.slice(5).trimStart())
      }
      if (data.length) yield { event, data: JSON.parse(data.join('\n')) } as RelayEvent
    }
  }
}

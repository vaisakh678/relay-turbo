import { AbortError, RelayError, StreamError } from './errors'
import type { StreamCallbacks, StreamEvent, StreamResult } from './types'

type Producer = (signal: AbortSignal) => AsyncGenerator<StreamEvent>

/**
 * One streamed reply. Starts immediately; consume it any (or several) of these ways:
 *   for await (const e of stream) …      // typed events
 *   for await (const t of stream.textStream) …  // just the text
 *   await stream.final                   // the whole result
 *   callbacks passed to relay.stream()
 */
export class RelayStream implements AsyncIterable<StreamEvent> {
  /** Resolves with the full result, rejects with a RelayError. */
  readonly final: Promise<StreamResult>

  private readonly controller = new AbortController()
  private readonly queue: StreamEvent[] = []
  private waiter: (() => void) | null = null
  private finished = false
  private failure: unknown = null
  private iterated = false

  constructor(produce: Producer, callbacks: StreamCallbacks = {}, signal?: AbortSignal) {
    if (signal) {
      if (signal.aborted) this.controller.abort()
      else signal.addEventListener('abort', () => this.abort(), { once: true })
    }
    this.final = this.pump(produce, callbacks)
    // Iterating or using callbacks without awaiting `final` must not cause an unhandled rejection.
    this.final.catch(() => {})
  }

  /** Stop the stream. The gateway cancels the model request, so you stop paying for it. */
  abort(): void {
    this.controller.abort()
  }

  get aborted(): boolean {
    return this.controller.signal.aborted
  }

  /** Only the text, chunk by chunk. */
  get textStream(): AsyncIterable<string> {
    const self = this
    return {
      async *[Symbol.asyncIterator]() {
        for await (const e of self) if (e.type === 'delta') yield e.text
      },
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterator<StreamEvent> {
    if (this.iterated) throw new RelayError('A RelayStream can only be iterated once')
    this.iterated = true
    for (;;) {
      const next = this.queue.shift()
      if (next) {
        yield next
        continue
      }
      if (this.finished) {
        if (this.failure) throw this.failure
        return
      }
      await new Promise<void>((resolve) => (this.waiter = resolve))
    }
  }

  private push(event: StreamEvent) {
    this.queue.push(event)
    this.wake()
  }

  private wake() {
    const w = this.waiter
    this.waiter = null
    w?.()
  }

  private async pump(produce: Producer, cb: StreamCallbacks): Promise<StreamResult> {
    const result: Partial<StreamResult> & { text: string } = { text: '', usage: { input: 0, output: 0 } }
    try {
      let done = false
      for await (const event of produce(this.controller.signal)) {
        switch (event.type) {
          case 'start':
            Object.assign(result, { id: event.id, model: event.model, promptVersion: event.promptVersion })
            cb.onStart?.(event)
            break
          case 'delta':
            result.text += event.text
            cb.onDelta?.(event.text, result.text)
            break
          case 'usage':
            result.usage = event.usage
            cb.onUsage?.(event.usage)
            break
          case 'done':
            result.finishReason = event.finishReason
            done = true
            break
        }
        this.push(event)
      }
      if (this.controller.signal.aborted) throw new AbortError()
      if (!done) throw new StreamError('The stream ended before completing', 0, 'incomplete_stream')

      const final = result as StreamResult
      cb.onDone?.(final)
      return final
    } catch (err) {
      const error =
        this.controller.signal.aborted && !(err instanceof AbortError)
          ? new AbortError()
          : err instanceof RelayError
            ? err
            : new StreamError(err instanceof Error ? err.message : String(err), 0, 'stream_failed')
      this.failure = error
      cb.onError?.(error)
      throw error
    } finally {
      this.finished = true
      this.wake()
    }
  }
}

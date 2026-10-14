export type Message = { role: 'user' | 'assistant'; content: string }

export type Usage = { input: number; output: number }

/** Events yielded while iterating a stream. Errors are thrown, not yielded. */
export type StreamEvent =
  | { type: 'start'; id: string; model: string; promptVersion: number }
  | { type: 'delta'; text: string }
  | { type: 'usage'; usage: Usage }
  | { type: 'done'; finishReason: string }

/** What `stream.final` and `relay.complete()` resolve to. */
export type StreamResult = {
  /** Request ID (matches the dashboard log and the webhook). */
  id: string
  model: string
  promptVersion: number
  text: string
  usage: Usage
  finishReason: string
}

export type StreamCallbacks = {
  onStart?: (event: Extract<StreamEvent, { type: 'start' }>) => void
  /** `text` is the new chunk; `snapshot` is everything so far. */
  onDelta?: (text: string, snapshot: string) => void
  onUsage?: (usage: Usage) => void
  onDone?: (result: StreamResult) => void
  onError?: (error: Error) => void
}

export type StreamInput = {
  messages: Message[]
  /**
   * Prompt variables from the client. Untrusted: any variable your backend
   * put in the token wins over a value sent here.
   */
  vars?: Record<string, string>
  /** Abort from outside (e.g. a component unmounting). Same as `stream.abort()`. */
  signal?: AbortSignal
}

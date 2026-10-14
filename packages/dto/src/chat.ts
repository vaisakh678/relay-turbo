// Wire protocol for POST /api/v1/chat (Server-Sent Events).
// Every client parses exactly these; change them only with a version bump.
export type RelayEvent =
  | { event: "start"; data: { id: string; model: string; promptVersion: number } }
  | { event: "delta"; data: { text: string } }
  | { event: "usage"; data: { input: number; output: number } }
  | { event: "error"; data: { code: "upstream_error" | "internal_error"; message: string } }
  | { event: "done"; data: { finishReason: string } };

export interface ChatRequestDTO {
  app: string;
  user: string;
  plan: string;
  vars?: Record<string, string>;
  messages: { role: "user" | "assistant"; content: string }[];
}

/** `meta` on a 429 from POST /chat. */
export interface RateLimitMeta {
  code: "rate_limited";
  limit: number;
  used: number;
  resetAt: string;
}

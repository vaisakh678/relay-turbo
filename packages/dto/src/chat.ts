// Wire protocol for POST /api/v1/chat (Server-Sent Events).
// Every client parses exactly these; change them only with a version bump.
export type RelayEvent =
  | { event: "start"; data: { id: string; model: string; promptVersion: number } }
  | { event: "delta"; data: { text: string } }
  | { event: "usage"; data: { input: number; output: number } }
  | { event: "error"; data: { code: "upstream_error" | "internal_error"; message: string } }
  | { event: "done"; data: { finishReason: string } };

/**
 * POST /api/v1/chat body. App, user and plan come from the bearer token
 * (`Authorization: Bearer <jwt>`); `vars` here are untrusted client input
 * and are overridden by any vars in the token.
 */
export interface ChatRequestDTO {
  vars?: Record<string, string>;
  messages: { role: "user" | "assistant"; content: string }[];
}

/** `meta` on a 429 from POST /chat. */
export interface RateLimitMeta {
  code: "rate_limited" | "test_cap";
  limit: number;
  used: number;
  resetAt: string;
}

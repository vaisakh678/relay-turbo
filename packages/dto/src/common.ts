export interface APIResponse<T, M = undefined> {
  data: T;
  message?: string;
  error?: string;
  /** Out-of-band metadata (e.g. limits), typed per endpoint. */
  meta?: M;
}

export interface CursorPagedResponse<T> {
  items: T[];
  nextCursor: string | null;
}

export type Provider = "anthropic" | "openai" | "google";
export type AppStatus = "live" | "paused";
export type RequestStatus = "ok" | "error" | "rate_limited" | "aborted";

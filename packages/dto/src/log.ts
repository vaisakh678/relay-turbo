import type { CursorPagedResponse, Provider, RequestStatus, TokenKind } from "./common";

export interface LogDTO {
  id: string;
  appId: string;
  externalUserId: string;
  plan: string;
  tokenKind: TokenKind;
  testTokenId: string | null;
  provider: Provider;
  model: string;
  promptVersion: number;
  status: RequestStatus;
  inputTokens: number;
  outputTokens: number;
  ttftMs: number | null;
  durationMs: number;
  /** Dollars. */
  cost: number;
  error: string | null;
  createdAt: string;
}

/** Live traffic only (test and Playground requests excluded). */
export interface AppStatsDTO {
  appId: string;
  requests: number;
  tokens: number;
  cost: number;
  errorRate: number;
  p50TtftMs: number | null;
}

export interface TimeseriesPointDTO {
  /** ISO timestamp of the start of the UTC hour. */
  hour: string;
  /** Request count keyed by app ID; apps with no requests are omitted. */
  byApp: Record<string, number>;
}

/** GET /logs — one page, newest first, plus the total for the current filters. */
export interface LogPageDTO extends CursorPagedResponse<LogDTO> {
  total: number;
}

import { pgEnum } from "drizzle-orm/pg-core";

export const appStatusEnum = pgEnum("app_status", ["live", "paused"]);

export const providerEnum = pgEnum("provider", ["anthropic", "openai", "google"]);

// Outcome of a single stream through the gateway.
//   ok           — completed normally
//   error        — upstream/provider or internal failure
//   rate_limited — rejected by the app's per-plan limit before calling the model
//   aborted      — client disconnected mid-stream (upstream was cancelled)
export const requestStatusEnum = pgEnum("request_status", [
  "ok",
  "error",
  "rate_limited",
  "aborted",
]);

// Which kind of token authorised a chat request.
//   live       — minted by the app's own backend (real users)
//   test       — a dashboard-issued test token (revocable, capped)
//   playground — short-lived token minted by the dashboard Playground
export const tokenKindEnum = pgEnum("token_kind", ["live", "test", "playground"]);

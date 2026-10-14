import { createHmac } from "node:crypto";

import { logger } from "./logger";

/**
 * POST a JSON payload signed like Stripe webhooks:
 *   X-Relay-Timestamp: unix seconds
 *   X-Relay-Signature: hex HMAC-SHA256 of `${timestamp}.${body}` with the app's signing secret
 * The receiver should reject timestamps older than ~60s to stop replays.
 * Best effort: failures are logged, never retried (yet).
 */
export async function sendWebhook(url: string, secret: string, payload: unknown): Promise<void> {
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Relay-Timestamp": timestamp,
        "X-Relay-Signature": signature,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) logger.warn({ url, status: res.status }, "Webhook returned non-2xx");
  } catch (err) {
    logger.warn({ url, err }, "Webhook delivery failed");
  }
}

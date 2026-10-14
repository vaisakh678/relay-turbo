import { env } from "../config/env";
import { logger } from "./logger";

type Email = { to: string; subject: string; text: string };

/**
 * Sends via Resend's HTTP API when RESEND_API_KEY + EMAIL_FROM are set. Without
 * them (local dev) the message is printed to the API log instead, so sign-in
 * codes still work on a laptop with no mail provider.
 */
export async function sendEmail({ to, subject, text }: Email): Promise<void> {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    if (process.env.NODE_ENV === "production") {
      logger.error({ to, subject }, "No email provider configured (set RESEND_API_KEY and EMAIL_FROM); email not sent");
      return;
    }
    logger.warn({ to, subject }, `\n\n📧 [dev email, not sent] To: ${to}\n   ${subject}\n   ${text}\n`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, text }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) logger.error({ to, status: res.status, body: await res.text().catch(() => "") }, "Resend rejected email");
}

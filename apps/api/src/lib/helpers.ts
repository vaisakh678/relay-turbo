import { randomBytes } from "node:crypto";

export function generateSigningSecret(): string {
  return `rls_live_${randomBytes(16).toString("hex")}`;
}

/** "sk-ant-api03-abc…wxyz" — enough to recognise a key, never enough to use it. */
export function maskSecret(secret: string): string {
  if (secret.length <= 12) return "•".repeat(secret.length);
  return `${secret.slice(0, 7)}${"•".repeat(12)}${secret.slice(-4)}`;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Replace {{name}} placeholders; unknown variables are left as-is. */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => vars[key] ?? match);
}

/** Midnight UTC today: daily limits reset at 00:00 UTC. */
export function startOfUtcDay(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function nextUtcDay(now = new Date()): Date {
  const d = startOfUtcDay(now);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

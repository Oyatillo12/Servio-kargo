/**
 * Per-tenant Telegram webhook secret (tasks.md F3).
 *
 * The webhook used to be authenticated by the bot token IN the URL path —
 * which put the token into every reverse-proxy access log line. Now the path
 * carries only the tenant id and Telegram proves itself with
 * `X-Telegram-Bot-Api-Secret-Token`, whose value is derived here: an HMAC of
 * the tenant id under the platform key (SESSION_SECRET). Deriving — rather
 * than storing a random secret per tenant — keeps it out of the database and
 * lets the web app (which calls `setWebhook`) and the bot server (which
 * verifies) agree without sharing anything but the key they already share.
 *
 * NOT exported from the package barrel: it needs `node:crypto`, and the
 * barrel is imported by browser bundles. Import via
 * `@kargotrack/shared/webhook`.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

/** Hex HMAC-SHA256 — 64 chars of [0-9a-f], within Telegram's 1–256 A-Za-z0-9_- rule. */
export function webhookSecretFor(platformKey: string, tenantId: string): string {
  return createHmac('sha256', platformKey)
    .update(`telegram-webhook:${tenantId}`)
    .digest('hex');
}

/** Constant-time string comparison for the header check. */
export function webhookSecretMatches(
  given: string,
  expected: string,
): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Error reporting for the bot process (AUDIT.md T5).
 *
 * Without this, a tenant's bot can start failing silently — a revoked token, a
 * dead DB connection, a handler throwing on every update — and the first signal
 * is an angry phone call. Every error we already log at `error` level is now
 * also reported.
 *
 * Two deliberate constraints:
 *
 * 1. **Optional.** With `SENTRY_DSN` unset every function here is a no-op, so
 *    local dev and a self-hosted pilot run unchanged. Never make the bot's
 *    behaviour depend on the reporter being configured.
 * 2. **The bot must never die** (CLAUDE.md rule 8). Sentry's own
 *    `OnUncaughtException` / `OnUnhandledRejection` integrations can terminate
 *    the process after capturing, so they are removed and `index.ts` keeps its
 *    own traps, which log, report, and continue.
 *
 * Everything leaving the process is scrubbed by `@kargotrack/shared`
 * (`scrubValue`) — see that module for why.
 */

import * as Sentry from '@sentry/node';

import { scrubValue } from '@kargotrack/shared';

import { logger } from './logger';

let enabled = false;

/** True when a DSN was configured and `initSentry` succeeded. */
export function isSentryEnabled(): boolean {
  return enabled;
}

/**
 * Initialise error reporting. Safe to call once at startup; does nothing when
 * `SENTRY_DSN` is empty. Never throws — a broken reporter must not stop the bot.
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) {
    logger.info('SENTRY_DSN not set — error reporting disabled');
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV ?? 'development',
      // Errors only. Performance tracing would burn the free-tier quota and we
      // measure latency in Postgres, not here.
      tracesSampleRate: 0,
      // Never let the SDK attach request bodies, headers, cookies or user ids.
      sendDefaultPii: false,
      // Explicit even though it is the SDK default: local variables in a stack
      // frame are the one channel that WOULD carry live customer rows (a
      // `customer` object, a track row) into a report. Scrubbing runs on the
      // serialized event, but the safest handling is to never collect them.
      // Source `contextLines` stay on — those are our own source lines, which
      // never contain customer data, and they are what makes a report readable.
      includeLocalVariables: false,
      // Rule 8: keep OUR process handlers, drop the ones that may exit.
      integrations: (defaults) =>
        defaults.filter(
          (i) =>
            i.name !== 'OnUncaughtException' && i.name !== 'OnUnhandledRejection',
        ),
      // Last line of defence: scrub the whole serialized event, whatever path
      // it arrived by (message, stack, breadcrumbs, extra, SQL params).
      beforeSend: (event) => scrubValue(event) as typeof event,
      beforeBreadcrumb: (crumb) => scrubValue(crumb) as typeof crumb,
    });
    enabled = true;
    logger.info('error reporting enabled');
  } catch (err) {
    logger.error({ err }, 'failed to initialise error reporting (continuing)');
  }
}

/** Extra context attached to a report; values are scrubbed before sending. */
export type ErrorContext = Record<string, unknown>;

/**
 * Report an error. A no-op when reporting is disabled, and never throws — call
 * it right next to the `logger.error` that already describes the failure.
 */
export function captureError(err: unknown, context?: ErrorContext): void {
  if (!enabled) return;
  try {
    Sentry.withScope((scope) => {
      if (context) scope.setExtras(scrubValue(context) as ErrorContext);
      Sentry.captureException(err);
    });
  } catch {
    // Reporting must never become a new failure mode.
  }
}

/** Flush pending reports on shutdown. Resolves even if the flush fails. */
export async function flushSentry(timeoutMs = 2000): Promise<void> {
  if (!enabled) return;
  try {
    await Sentry.flush(timeoutMs);
  } catch {
    // ignore
  }
}

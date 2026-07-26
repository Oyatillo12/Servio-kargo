/**
 * Error reporting for the admin panel (AUDIT.md T5).
 *
 * Mirrors `apps/bot/src/sentry.ts` — same optional-DSN rule, same scrubbing —
 * but with one important difference in reach, documented honestly:
 *
 * Next.js 14 catches errors thrown by server components and server actions and
 * renders an error boundary instead of letting them reach a process-level hook.
 * `@sentry/node` alone therefore does NOT auto-capture them. What we do instead:
 * `app/error.tsx` and `app/global-error.tsx` call {@link reportClientError}, so
 * every error an admin actually sees is reported, with its route. Errors that
 * reach the Node runtime (queue producers, instrumentation, startup) are caught
 * by the SDK directly.
 *
 * Full auto-instrumentation needs `@sentry/nextjs`, which adds a build-time
 * webpack plugin. That is deliberately deferred: `next build` in this repo has a
 * known local failure mode (PROJECT.md §8), so the change could not be verified
 * before the pilot. See AUDIT.md T13.
 */

import 'server-only';

import * as Sentry from '@sentry/node';

import { scrubValue } from '@kargotrack/shared';

let enabled = false;
let initialised = false;

/**
 * Initialise error reporting. Called from `instrumentation.ts` on server
 * startup, and lazily by {@link captureError} so a report is never lost just
 * because the hook did not run (e.g. in `next dev`). Never throws.
 */
export function initObservability(): void {
  if (initialised) return;
  initialised = true;

  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return;

  try {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV ?? 'development',
      tracesSampleRate: 0,
      sendDefaultPii: false,
      // See apps/bot/src/sentry.ts: local variables are the one channel that
      // would carry live customer rows into a report, so they are never
      // collected. Source context lines stay on.
      includeLocalVariables: false,
      // Everything leaving the process is scrubbed — an exception message can
      // easily carry a customer phone, a track code or a connection string.
      beforeSend: (event) => scrubValue(event) as typeof event,
      beforeBreadcrumb: (crumb) => scrubValue(crumb) as typeof crumb,
    });
    enabled = true;
  } catch {
    // A broken reporter must not take the panel down.
  }
}

/** True when a DSN was configured and init succeeded. */
export function isObservabilityEnabled(): boolean {
  return enabled;
}

/** Extra context attached to a report; scrubbed before sending. */
export type ErrorContext = Record<string, unknown>;

/** Report an error. No-op when disabled; never throws. */
export function captureError(err: unknown, context?: ErrorContext): void {
  initObservability();
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

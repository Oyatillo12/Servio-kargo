import { APP_NAME } from '@kargotrack/shared';

/**
 * Runs once on server startup (enabled via experimental.instrumentationHook).
 * Feature tasks may use this to warm connections or start background workers.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Error reporting first, so anything that fails below is reported too.
    // Imported dynamically: this module is also evaluated in the edge runtime,
    // where `server-only` + @sentry/node must not be pulled in (AUDIT.md T5).
    const { initObservability, isObservabilityEnabled } = await import(
      './lib/observability'
    );
    initObservability();

    const port = process.env.PORT ?? 3000;
    // eslint-disable-next-line no-console
    console.log(
      `${APP_NAME} web ready on :${port}` +
        (isObservabilityEnabled() ? ' (error reporting on)' : ''),
    );
  }
}

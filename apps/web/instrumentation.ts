import { APP_NAME } from '@kargotrack/shared';

/**
 * Runs once on server startup (enabled via experimental.instrumentationHook).
 * Feature tasks may use this to warm connections or start background workers.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const port = process.env.PORT ?? 3000;
    // eslint-disable-next-line no-console
    console.log(`${APP_NAME} web ready on :${port}`);
  }
}

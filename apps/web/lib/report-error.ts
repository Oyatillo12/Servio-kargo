'use server';

import { captureError } from './observability';

/**
 * Server action the client error boundaries call so a failure an admin actually
 * saw becomes a report (AUDIT.md T5). Next.js hands the boundary a redacted
 * error in production — only `message` and `digest` survive — so the digest is
 * what ties this report to the full stack trace in the server log.
 *
 * Deliberately returns nothing and never throws: an error while reporting an
 * error must not replace the error page with a worse one.
 */
export async function reportClientErrorAction(input: {
  message: string;
  digest?: string;
  pathname?: string;
}): Promise<void> {
  try {
    const err = new Error(input.message || 'Unknown client error');
    err.name = 'AdminPanelError';
    captureError(err, {
      digest: input.digest,
      pathname: input.pathname,
      surface: 'error-boundary',
    });
  } catch {
    // ignore
  }
}

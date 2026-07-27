/**
 * Public origin of the site, for metadataBase / sitemap / robots / JSON-LD.
 *
 * Read from APP_URL (server-side, no NEXT_PUBLIC_ prefix on purpose). The
 * landing pages, sitemap and robots are statically generated, so this value
 * is baked at `next build`; the Docker build stage has no .env, which makes
 * the fallback below the effective production value — keep it the real
 * origin.
 */
export function getBaseUrl(): string {
  const raw = process.env.APP_URL?.trim();
  return (raw || 'https://kargotrack.uz').replace(/\/+$/, '');
}

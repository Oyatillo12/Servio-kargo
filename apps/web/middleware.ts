import { NextResponse, type NextRequest } from 'next/server';

import { COOKIE_NAME } from '@/lib/session-cookie';

/**
 * Signed-in admins never see the sales page — `/` and `/ru` send them to the
 * panel instead.
 *
 * This only checks that the cookie EXISTS; verifying the HMAC needs
 * `node:crypto`, which the edge runtime does not have. A stale or forged
 * cookie therefore bounces to `/dashboard`, where `requireAdmin` rejects it
 * and forwards to `/login` — the right destination either way, just one hop
 * longer. Crawlers carry no cookie, so the landing stays indexable.
 *
 * Doing this here rather than in the pages keeps both landings statically
 * rendered: reading `cookies()` inside them would opt the whole tree into
 * dynamic rendering.
 */
export function middleware(request: NextRequest) {
  if (request.cookies.has(COOKIE_NAME)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/ru'],
};

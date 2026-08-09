/**
 * Best-effort caller IP for pre-auth throttling. In production Caddy is the
 * only ingress and sets X-Forwarded-For; the first entry is the client. This
 * is a throttling signal, not an identity — a spoofed header only lets an
 * attacker throttle themselves harder, never impersonate a session.
 */

import 'server-only';

import { headers } from 'next/headers';

export function clientIp(): string | null {
  const h = headers();
  const xff = h.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return h.get('x-real-ip');
}

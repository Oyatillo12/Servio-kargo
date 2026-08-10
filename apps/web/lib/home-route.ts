/**
 * Where a signed-in employee belongs when they haven't asked for anywhere.
 *
 * A warehouse hand goes straight to the scale (`/weigh`): it is their entire
 * day, and the dashboard is a screen of numbers they are not allowed to read
 * anyway. Everyone else gets the dashboard.
 *
 * One place answers this, so the login action, the invite redemption, the
 * "already signed in" bounce on /login and the capability guard can never send
 * the same person to three different screens.
 *
 * Framework-free (no `server-only`) on purpose — the login page imports it too.
 */

import { can, toAdminRole } from '@kargotrack/shared';

export function homeRouteFor(role: string | null | undefined): string {
  // The capability check is belt-and-braces: `/weigh` guards itself with
  // `requireCapability('tracks.weigh')`, and sending someone to a page that
  // redirects them back here would be a loop, not a landing.
  return toAdminRole(role) === 'warehouse' && can(role, 'tracks.weigh')
    ? '/weigh'
    : '/dashboard';
}

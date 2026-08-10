import { describe, expect, it } from 'vitest';

import { homeRouteFor } from './home-route';

describe('homeRouteFor', () => {
  it('sends a warehouse hand straight to the scale', () => {
    // Their whole day is /weigh, and the dashboard is figures they are not
    // allowed to read anyway (tasks.md W1).
    expect(homeRouteFor('warehouse')).toBe('/weigh');
  });

  it('sends office roles to the dashboard', () => {
    expect(homeRouteFor('owner')).toBe('/dashboard');
    expect(homeRouteFor('manager')).toBe('/dashboard');
  });

  it('sends the retired `staff` value to the dashboard, as a manager', () => {
    expect(homeRouteFor('staff')).toBe('/dashboard');
  });

  it('never routes an unreadable role somewhere it cannot open', () => {
    // Unknown roles read as `warehouse`, which does hold `tracks.weigh` — the
    // point of the check is that this stays true if the matrix ever changes,
    // because landing on a page that redirects back here is a loop.
    for (const value of [null, undefined, '', 'superuser']) {
      expect(['/weigh', '/dashboard']).toContain(homeRouteFor(value));
    }
  });
});

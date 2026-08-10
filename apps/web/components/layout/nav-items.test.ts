import { describe, expect, it } from 'vitest';

import { navFor, primaryNavFor, secondaryNavFor, NAV_ITEMS } from './nav-items';

const hrefs = (items: { href: string }[]) => items.map((i) => i.href);

describe('navFor', () => {
  it('gives an owner every destination', () => {
    expect(navFor('owner')).toHaveLength(NAV_ITEMS.length);
  });

  it('hides screens a role cannot open', () => {
    // A nav row leading to a page that redirects is worse than no row — the
    // pages guard themselves regardless (`requireCapability`).
    expect(hrefs(navFor('warehouse'))).not.toContain('/settings');
    expect(hrefs(navFor('warehouse'))).not.toContain('/debtors');
    expect(hrefs(navFor('manager'))).not.toContain('/broadcast');
  });

  it('offers the scale to everyone who may weigh', () => {
    for (const role of ['owner', 'manager', 'warehouse']) {
      expect(hrefs(navFor(role))).toContain('/weigh');
    }
  });
});

describe('the mobile tab bar', () => {
  it('puts the scale in a warehouse hand’s bar, not behind “more”', () => {
    // It is their day's work several hundred times over; one extra tap each
    // time is the whole cost of getting this wrong (tasks.md W1).
    expect(hrefs(primaryNavFor('warehouse'))).toEqual([
      '/weigh',
      '/tracks',
      '/customers',
    ]);
    expect(hrefs(secondaryNavFor('warehouse'))).toContain('/dashboard');
  });

  it('leaves the office bar as it was', () => {
    expect(hrefs(primaryNavFor('owner'))).toEqual([
      '/dashboard',
      '/tracks',
      '/customers',
      '/import',
    ]);
    expect(hrefs(secondaryNavFor('owner'))).toContain('/weigh');
  });

  it('splits every reachable destination into exactly one half', () => {
    for (const role of ['owner', 'manager', 'warehouse']) {
      const all = hrefs(navFor(role)).sort();
      const split = [
        ...hrefs(primaryNavFor(role)),
        ...hrefs(secondaryNavFor(role)),
      ].sort();
      expect(split).toEqual(all);
    }
  });
});

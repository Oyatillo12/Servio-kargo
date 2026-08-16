import { describe, expect, it } from 'vitest';

import {
  BILLING_GRACE_DAYS,
  BILLING_WARN_DAYS,
  billingCutoffDate,
  billingNeedsBanner,
  billingState,
} from './billing';

// Asia/Tashkent is a fixed UTC+5, so its calendar day flips at 19:00 UTC.
// 12:00Z on 2026-08-16 is comfortably mid-day there (17:00 local).
const NOW = new Date('2026-08-16T12:00:00Z');

/** `YYYY-MM-DD` `n` days from the Tashkent day of NOW (negative = past). */
function dayFromNow(n: number): string {
  return new Date(Date.UTC(2026, 7, 16 + n)).toISOString().slice(0, 10);
}

describe('billingState — unset billing (SPEC 7.19)', () => {
  it('reads null as `none`: a tenant without a date is never touched', () => {
    expect(billingState(null, NOW)).toEqual({
      state: 'none',
      paidUntil: null,
      daysLeft: null,
      graceDaysLeft: null,
    });
  });

  it('reads undefined as `none`', () => {
    expect(billingState(undefined, NOW).state).toBe('none');
  });

  it('reads a malformed date as `none` rather than throwing', () => {
    // This runs on every panel render and inside the sweep; the safe failure
    // is "disable nobody", not a 500.
    expect(billingState('16.08.2026', NOW).state).toBe('none');
    expect(billingState('', NOW).state).toBe('none');
  });
});

describe('billingState — paid (SPEC 7.19)', () => {
  it('is `ok` well before the deadline, with no banner', () => {
    const status = billingState(dayFromNow(30), NOW);
    expect(status.state).toBe('ok');
    expect(status.daysLeft).toBe(30);
    expect(billingNeedsBanner(status)).toBe(false);
  });

  it('is still `ok` one day outside the warning window', () => {
    expect(billingState(dayFromNow(BILLING_WARN_DAYS + 1), NOW).state).toBe('ok');
  });

  it('turns `due-soon` exactly at the warning boundary', () => {
    const status = billingState(dayFromNow(BILLING_WARN_DAYS), NOW);
    expect(status.state).toBe('due-soon');
    expect(status.daysLeft).toBe(7);
    expect(billingNeedsBanner(status)).toBe(true);
  });

  it('a tenant paid THROUGH today is due-soon, not in grace', () => {
    // `paid_until` is paid through the end of that day (SPEC 7.19).
    const status = billingState(dayFromNow(0), NOW);
    expect(status.state).toBe('due-soon');
    expect(status.daysLeft).toBe(0);
    expect(status.graceDaysLeft).toBeNull();
  });
});

describe('billingState — grace and expiry (SPEC 7.19)', () => {
  it('enters grace the day after `paid_until`, counting to the cut-off', () => {
    const status = billingState(dayFromNow(-1), NOW);
    expect(status.state).toBe('grace');
    expect(status.daysLeft).toBe(-1);
    expect(status.graceDaysLeft).toBe(BILLING_GRACE_DAYS - 1);
    expect(billingNeedsBanner(status)).toBe(true);
  });

  it('the last grace day still works, with zero days left', () => {
    const status = billingState(dayFromNow(-BILLING_GRACE_DAYS), NOW);
    expect(status.state).toBe('grace');
    expect(status.graceDaysLeft).toBe(0);
  });

  it('expires the day after grace runs out', () => {
    const status = billingState(dayFromNow(-BILLING_GRACE_DAYS - 1), NOW);
    expect(status.state).toBe('expired');
    expect(status.graceDaysLeft).toBeNull();
    // Expiry is not a banner state — by then the lock screen has taken over.
    expect(billingNeedsBanner(status)).toBe(false);
  });

  it('stays expired however long ago the date was', () => {
    expect(billingState('2024-01-01', NOW).state).toBe('expired');
  });
});

describe('billingState — the Tashkent day boundary (SPEC 7.9)', () => {
  it('a tenant paid until today is fine at 18:59Z and in grace at 19:01Z', () => {
    // 2026-08-16 19:00Z is midnight on the 17th in Tashkent.
    const paidUntil = '2026-08-16';
    expect(billingState(paidUntil, new Date('2026-08-16T18:59:00Z')).state).toBe(
      'due-soon',
    );
    const after = billingState(paidUntil, new Date('2026-08-16T19:01:00Z'));
    expect(after.state).toBe('grace');
    expect(after.daysLeft).toBe(-1);
  });

  it('does not roll a day early at UTC midnight', () => {
    // 00:30Z on the 17th is still 05:30 on the 17th in Tashkent — same day.
    expect(billingState('2026-08-17', new Date('2026-08-17T00:30:00Z')).daysLeft).toBe(0);
  });
});

describe('billingCutoffDate — the sweep and the state agree', () => {
  it('a date below the cutoff is exactly an expired tenant', () => {
    const cutoff = billingCutoffDate(NOW);
    // The SQL sweep filters `paid_until < cutoff`; walk the whole boundary and
    // require it to match the pure state, so the two can never drift.
    for (let offset = 2; offset >= -12; offset -= 1) {
      const paidUntil = dayFromNow(-offset);
      const expired = billingState(paidUntil, NOW).state === 'expired';
      expect(paidUntil < cutoff).toBe(expired);
    }
  });

  it('is grace-days behind the current Tashkent day', () => {
    expect(billingCutoffDate(NOW)).toBe(dayFromNow(-BILLING_GRACE_DAYS));
  });

  it('follows the Tashkent day across the 19:00Z flip', () => {
    expect(billingCutoffDate(new Date('2026-08-16T18:59:00Z'))).toBe('2026-08-09');
    expect(billingCutoffDate(new Date('2026-08-16T19:01:00Z'))).toBe('2026-08-10');
  });
});

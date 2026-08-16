/**
 * Tenant billing-lite state (SPEC §7.19, tasks.md J — D-011).
 *
 * `tenants.paid_until` is a DATE, and a tenant is paid THROUGH the end of that
 * day in Asia/Tashkent — the same calendar day the dashboard counts (§7.9).
 * Everything below therefore reasons in Tashkent day *keys* (`YYYY-MM-DD`) and
 * plain day arithmetic, never in instants: once both sides are calendar dates
 * there is no zone left to get wrong.
 *
 * This is the only place that answers "where does this tenant stand". The panel
 * banner, the lock screen, the `/sa` expiring list and the hourly auto-disable
 * sweep all read it, so they can never disagree about who is cut off.
 */

import { tashkentDateKey } from './dashboard';

/** Days before `paid_until` at which the panel banner appears (§5.17). */
export const BILLING_WARN_DAYS = 7;

/** Days of full service after `paid_until` before the sweep disables (§7.19). */
export const BILLING_GRACE_DAYS = 7;

/**
 * - `none` — no `paid_until`: billing is not set for this tenant. It never
 *   warns and never auto-disables (existing tenants must not lock themselves
 *   the hour this ships).
 * - `ok` — paid, more than `BILLING_WARN_DAYS` left.
 * - `due-soon` — paid, but the banner is up.
 * - `grace` — past `paid_until`, still fully working.
 * - `expired` — past the grace period; the sweep sets `active = false`.
 */
export type BillingState = 'none' | 'ok' | 'due-soon' | 'grace' | 'expired';

export interface BillingStatus {
  state: BillingState;
  paidUntil: string | null;
  /**
   * Whole Tashkent days from today to `paid_until`: 0 = paid through today,
   * negative once past it. `null` when billing is not set.
   */
  daysLeft: number | null;
  /**
   * Days until the service is actually cut off, counted only while in `grace`
   * (0 = today is the last working day). `null` in every other state — before
   * `paid_until` the answer is "not yet due", and after the cut-off there is
   * nothing left to count down.
   */
  graceDaysLeft: number | null;
}

const DAY_MS = 86_400_000;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** A `YYYY-MM-DD` key as a day ordinal, so two dates can simply be subtracted. */
function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

/** A day ordinal back as a `YYYY-MM-DD` key. */
function dateKey(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Where a tenant stands right now. A malformed `paid_until` reads as `none`
 * rather than throwing: this runs on every panel render and inside the sweep,
 * and the safe failure is "do not disable anyone", not a 500.
 */
export function billingState(
  paidUntil: string | null | undefined,
  now: Date,
): BillingStatus {
  if (!paidUntil || !DATE_KEY.test(paidUntil)) {
    return { state: 'none', paidUntil: null, daysLeft: null, graceDaysLeft: null };
  }
  const daysLeft = dayNumber(paidUntil) - dayNumber(tashkentDateKey(now));
  if (daysLeft >= 0) {
    return {
      state: daysLeft > BILLING_WARN_DAYS ? 'ok' : 'due-soon',
      paidUntil,
      daysLeft,
      graceDaysLeft: null,
    };
  }
  if (daysLeft >= -BILLING_GRACE_DAYS) {
    return {
      state: 'grace',
      paidUntil,
      daysLeft,
      graceDaysLeft: BILLING_GRACE_DAYS + daysLeft,
    };
  }
  return { state: 'expired', paidUntil, daysLeft, graceDaysLeft: null };
}

/**
 * The `YYYY-MM-DD` boundary the auto-disable sweep filters on: a tenant is
 * expired exactly when `paid_until < billingCutoffDate(now)`. Exported so the
 * one SQL `UPDATE` and `billingState` cannot drift apart — a test pins them
 * to each other.
 */
export function billingCutoffDate(now: Date): string {
  return dateKey(dayNumber(tashkentDateKey(now)) - BILLING_GRACE_DAYS);
}

/** True while the panel shows a billing banner (§5.17) — amber or red. */
export function billingNeedsBanner(status: BillingStatus): boolean {
  return status.state === 'due-soon' || status.state === 'grace';
}

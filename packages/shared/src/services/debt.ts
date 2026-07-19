/**
 * Debt calculation (SPEC §7.5, CLAUDE.md data model).
 *
 * Debt per customer = SUM(price_tiyin of the customer's tracks in
 * READY_FOR_PICKUP or DELIVERED, excluding soft-deleted) − SUM(payments).
 * A negative result means the customer is in advance (display as `Avans`).
 *
 * Pure function over plain data — the caller does the tenant-scoped queries.
 */

import type { TrackStatus } from '../status';

export interface DebtTrack {
  currentStatus: TrackStatus;
  priceTiyin: number | null;
  deletedAt: Date | null;
}

export interface DebtPayment {
  amountTiyin: number;
}

/** Statuses whose price counts toward debt. */
const OWED_STATUSES: ReadonlySet<TrackStatus> = new Set<TrackStatus>([
  'READY_FOR_PICKUP',
  'DELIVERED',
]);

/**
 * Net debt in tiyin. Positive = owed, negative = advance, 0 = settled.
 */
export function computeDebtTiyin(
  tracks: DebtTrack[],
  payments: DebtPayment[],
): number {
  const owed = tracks.reduce((sum, t) => {
    if (t.deletedAt != null) return sum;
    if (!OWED_STATUSES.has(t.currentStatus)) return sum;
    return sum + (t.priceTiyin ?? 0);
  }, 0);
  const paid = payments.reduce((sum, p) => sum + p.amountTiyin, 0);
  return owed - paid;
}

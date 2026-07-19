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

/** Classification of a net debt figure for display (SPEC §7.5). */
export type DebtKind = 'debt' | 'advance' | 'settled';

export interface DebtSummary {
  /** Signed net in tiyin: positive = owed, negative = advance, 0 = settled. */
  netTiyin: number;
  kind: DebtKind;
  /** Absolute value for display — callers never render a leading minus (§7.5). */
  magnitudeTiyin: number;
}

/**
 * Classify a net debt (as produced by {@link computeDebtTiyin}) into
 * debt/advance/settled + its display magnitude. Single source of the sign rule
 * so the admin UI and bot don't each re-derive "> 0 ? debt : < 0 ? advance …".
 */
export function describeDebt(netTiyin: number): DebtSummary {
  const kind: DebtKind =
    netTiyin > 0 ? 'debt' : netTiyin < 0 ? 'advance' : 'settled';
  return { netTiyin, kind, magnitudeTiyin: Math.abs(netTiyin) };
}

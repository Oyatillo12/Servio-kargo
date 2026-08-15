/**
 * Handover counter rules (SPEC §5.15, tasks.md G, decision D-003).
 *
 * Pure + framework-free: which parcels may be handed over, and what the
 * pre-filled payment amount is. The status transition itself stays with
 * `planBulkStatusChange` and the money stays a customer-level `payments` row
 * (D-003) — this module only encodes the counter's two questions: "which
 * boxes can leave?" and "how much is that?".
 */

import type { TrackStatus } from '../status';

/**
 * Statuses a parcel can be handed over from. READY_FOR_PICKUP is the normal
 * case; TASHKENT_WAREHOUSE is the real-world shortcut — the box is physically
 * at the counter even though nobody pressed "ready" (SPEC §5.15 step 2).
 */
export const HANDOVER_ELIGIBLE_STATUSES: readonly TrackStatus[] = [
  'READY_FOR_PICKUP',
  'TASHKENT_WAREHOUSE',
];

const ELIGIBLE: ReadonlySet<TrackStatus> = new Set(HANDOVER_ELIGIBLE_STATUSES);

export interface HandoverTrack {
  currentStatus: TrackStatus;
  priceTiyin: number | null;
  deletedAt: Date | null;
}

/** Whether this track can appear on the handover screen at all. */
export function isHandoverEligible(track: HandoverTrack): boolean {
  return track.deletedAt == null && ELIGIBLE.has(track.currentStatus);
}

/**
 * The pre-filled payment amount for a selection: the sum of the selected
 * parcels' prices, an unpriced parcel counting as 0 (§5.15 step 2 — allowed,
 * but the UI marks it). Same NULL-as-0 rule as the debt aggregate (§7.5), so
 * the counter and the balance can never disagree about the same parcels.
 */
export function handoverTotalTiyin(tracks: readonly HandoverTrack[]): number {
  return tracks.reduce((sum, t) => sum + (t.priceTiyin ?? 0), 0);
}

/** How many of the selected parcels have no price yet (drives the warning). */
export function countUnpriced(tracks: readonly HandoverTrack[]): number {
  return tracks.reduce((n, t) => n + (t.priceTiyin == null ? 1 : 0), 0);
}

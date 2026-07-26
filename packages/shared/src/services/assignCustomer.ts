/**
 * Track → customer assignment planner (SPEC §5.3, §7.3).
 *
 * Single source of truth for what changing a track's owner should do, shared by
 * the single-track panel action and the bulk assigner so the two never drift —
 * the same role `planStatusChange` plays for status writes.
 *
 * Deliberately does NOT notify. §4.2 notifications fire on *status* changes; a
 * day-0 import that attaches 500 historical tracks to their owners would
 * otherwise blast 500 "your parcel is ready" messages about parcels the
 * customer collected weeks ago. The customer sees the tracks in 📦 Mening
 * yuklarim immediately, which is the point of attaching them.
 *
 * Pure + framework-free.
 */

export type AssignAction =
  /** Unowned track gets an owner. */
  | 'attach'
  /** Owned track loses its owner (mistaken claim, §7.3). */
  | 'detach'
  /** Owned track moves to a different owner. */
  | 'reassign'
  /** Already in the requested state — write nothing (§2 no-op rule). */
  | 'noop';

export interface AssignCustomerInput {
  /** The track's owner before the write, or `null` when unclaimed. */
  currentCustomerId: string | null;
  /** The requested owner, or `null` to detach. */
  newCustomerId: string | null;
}

export interface AssignCustomerPlan {
  action: AssignAction;
  /** Update `tracks.customer_id`. False for a no-op. */
  willWrite: boolean;
  /** Append a `track_events` audit row (CLAUDE.md rule 7 — never overwrite history). */
  willEvent: boolean;
  /** `track_events.meta` payload, or `null` when nothing is written. */
  eventMeta: AssignEventMeta | null;
}

/**
 * Audit payload for an assignment event. The event's `status` column carries
 * the track's *unchanged* current status (the column is NOT NULL), so `action`
 * is what tells a reader this row is an ownership change, not a status change.
 */
export interface AssignEventMeta {
  action: Exclude<AssignAction, 'noop'>;
  fromCustomerId: string | null;
  toCustomerId: string | null;
}

/** Meta actions that mark a `track_events` row as an ownership change. */
export const ASSIGN_ACTIONS = ['attach', 'detach', 'reassign'] as const;

/** True when a `track_events.meta` blob describes an ownership change. */
export function isAssignEventMeta(meta: unknown): meta is AssignEventMeta {
  if (typeof meta !== 'object' || meta === null) return false;
  const action = (meta as { action?: unknown }).action;
  return ASSIGN_ACTIONS.includes(action as (typeof ASSIGN_ACTIONS)[number]);
}

/**
 * Decide the effects of setting `newCustomerId` as the track's owner.
 *  - Same owner (including null → null) → no-op: no write, no event.
 *  - null → someone = `attach`; someone → null = `detach`; A → B = `reassign`.
 *
 * Whether the target customer exists and belongs to this tenant is the caller's
 * job (CLAUDE.md rule 1) — this function only decides, it never trusts an id.
 */
export function planAssignCustomer(
  input: AssignCustomerInput,
): AssignCustomerPlan {
  const { currentCustomerId, newCustomerId } = input;

  if (currentCustomerId === newCustomerId) {
    return {
      action: 'noop',
      willWrite: false,
      willEvent: false,
      eventMeta: null,
    };
  }

  const action: Exclude<AssignAction, 'noop'> =
    currentCustomerId == null
      ? 'attach'
      : newCustomerId == null
        ? 'detach'
        : 'reassign';

  return {
    action,
    willWrite: true,
    willEvent: true,
    eventMeta: {
      action,
      fromCustomerId: currentCustomerId,
      toCustomerId: newCustomerId,
    },
  };
}

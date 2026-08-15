/**
 * Payment storno (tasks.md A7).
 *
 * A cancellation never updates or deletes the original row: it plans a NEW
 * payment row with the negated amount pointing back via `reversal_of`, so the
 * ledger stays append-only and every read that sums payments — debt (§7.5),
 * tushum, cash-by-staff — nets the pair out with no special casing. The
 * database enforces at-most-one reversal per payment (partial unique index on
 * `reversal_of`); this module is the tested home of the business rules the
 * caller checks first, so a race just surfaces as the index refusing.
 */

export interface ReversiblePayment {
  id: string;
  amountTiyin: number;
  method: 'cash' | 'click' | 'payme' | 'other';
  /** Non-null when this row is itself a storno. */
  reversalOf: string | null;
}

export type PlanReversalResult =
  | {
      ok: true;
      /** Values of the storno row to insert (caller adds tenant/customer/actor). */
      insert: {
        amountTiyin: number;
        method: ReversiblePayment['method'];
        reversalOf: string;
      };
    }
  | { ok: false; error: 'IS_REVERSAL' | 'ALREADY_REVERSED' };

/**
 * Plan the storno row for `original`. Refuses to reverse a reversal (undo of a
 * mistaken storno = record the payment again, keeping the trail readable) and
 * to reverse twice. The reason is required by the callers and travels in
 * `note`; it is not this module's concern.
 */
export function planPaymentReversal(
  original: ReversiblePayment,
  alreadyReversed: boolean,
): PlanReversalResult {
  if (original.reversalOf !== null) return { ok: false, error: 'IS_REVERSAL' };
  if (alreadyReversed) return { ok: false, error: 'ALREADY_REVERSED' };
  return {
    ok: true,
    insert: {
      amountTiyin: -original.amountTiyin,
      method: original.method,
      reversalOf: original.id,
    },
  };
}

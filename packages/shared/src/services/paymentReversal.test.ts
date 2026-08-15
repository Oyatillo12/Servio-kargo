import { describe, expect, it } from 'vitest';

import { computeDebtTiyin } from './debt';
import { planPaymentReversal, type ReversiblePayment } from './paymentReversal';

const original: ReversiblePayment = {
  id: 'pay-1',
  amountTiyin: 125_000_00,
  method: 'cash',
  reversalOf: null,
};

describe('planPaymentReversal', () => {
  it('plans the exact negated amount, same method, linked to the original', () => {
    const res = planPaymentReversal(original, false);
    expect(res).toEqual({
      ok: true,
      insert: {
        amountTiyin: -125_000_00,
        method: 'cash',
        reversalOf: 'pay-1',
      },
    });
  });

  it('refuses to reverse twice', () => {
    expect(planPaymentReversal(original, true)).toEqual({
      ok: false,
      error: 'ALREADY_REVERSED',
    });
  });

  it('refuses to reverse a storno row — undo means recording the payment again', () => {
    const storno: ReversiblePayment = {
      id: 'pay-2',
      amountTiyin: -125_000_00,
      method: 'cash',
      reversalOf: 'pay-1',
    };
    expect(planPaymentReversal(storno, false)).toEqual({
      ok: false,
      error: 'IS_REVERSAL',
    });
  });

  it('nets the pair out of the customer debt with no special casing', () => {
    // The reason storno is a negative ROW: computeDebtTiyin (§7.5) just sums.
    const tracks = [
      {
        currentStatus: 'DELIVERED' as const,
        priceTiyin: 300_000_00,
        deletedAt: null,
      },
    ];
    const res = planPaymentReversal(original, false);
    if (!res.ok) throw new Error('expected ok');
    const debt = computeDebtTiyin(tracks, [
      { amountTiyin: original.amountTiyin },
      { amountTiyin: res.insert.amountTiyin },
    ]);
    expect(debt).toBe(300_000_00);
  });
});

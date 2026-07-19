import { describe, expect, it } from 'vitest';

import { computeDebtTiyin, describeDebt, type DebtTrack } from './debt';

const track = (over: Partial<DebtTrack>): DebtTrack => ({
  currentStatus: 'READY_FOR_PICKUP',
  priceTiyin: 1_000_000,
  deletedAt: null,
  ...over,
});

describe('computeDebtTiyin (SPEC §7.5)', () => {
  it('sums price of READY_FOR_PICKUP + DELIVERED minus payments', () => {
    const tracks = [
      track({ currentStatus: 'READY_FOR_PICKUP', priceTiyin: 3_000_000 }),
      track({ currentStatus: 'DELIVERED', priceTiyin: 2_000_000 }),
    ];
    const payments = [{ amountTiyin: 1_000_000 }];
    expect(computeDebtTiyin(tracks, payments)).toBe(4_000_000);
  });

  it('excludes tracks not yet ready (in-transit etc.)', () => {
    const tracks = [
      track({ currentStatus: 'IN_TRANSIT', priceTiyin: 9_000_000 }),
      track({ currentStatus: 'CHINA_WAREHOUSE', priceTiyin: 9_000_000 }),
      track({ currentStatus: 'READY_FOR_PICKUP', priceTiyin: 1_000_000 }),
    ];
    expect(computeDebtTiyin(tracks, [])).toBe(1_000_000);
  });

  it('excludes soft-deleted tracks', () => {
    const tracks = [
      track({ priceTiyin: 5_000_000, deletedAt: new Date() }),
      track({ priceTiyin: 1_000_000 }),
    ];
    expect(computeDebtTiyin(tracks, [])).toBe(1_000_000);
  });

  it('treats null price as 0', () => {
    const tracks = [track({ priceTiyin: null })];
    expect(computeDebtTiyin(tracks, [])).toBe(0);
  });

  it('returns a negative value (advance) when overpaid', () => {
    const tracks = [track({ priceTiyin: 1_000_000 })];
    const payments = [{ amountTiyin: 1_500_000 }];
    expect(computeDebtTiyin(tracks, payments)).toBe(-500_000);
  });

  it('is 0 when settled', () => {
    const tracks = [track({ priceTiyin: 2_000_000 })];
    expect(computeDebtTiyin(tracks, [{ amountTiyin: 2_000_000 }])).toBe(0);
  });

  it('mixes statuses, null prices and overpayment into a net advance', () => {
    const tracks = [
      track({ currentStatus: 'READY_FOR_PICKUP', priceTiyin: 2_000_000 }),
      track({ currentStatus: 'DELIVERED', priceTiyin: null }), // owed but unpriced → 0
      track({ currentStatus: 'IN_TRANSIT', priceTiyin: 9_000_000 }), // not owed yet
    ];
    // owed = 2_000_000; paid 3_000_000 → advance of 1_000_000.
    expect(computeDebtTiyin(tracks, [{ amountTiyin: 3_000_000 }])).toBe(
      -1_000_000,
    );
  });
});

describe('describeDebt (SPEC §7.5)', () => {
  it('classifies a positive net as debt', () => {
    expect(describeDebt(1_500_000)).toEqual({
      netTiyin: 1_500_000,
      kind: 'debt',
      magnitudeTiyin: 1_500_000,
    });
  });

  it('classifies a negative net as advance with an absolute magnitude', () => {
    expect(describeDebt(-500_000)).toEqual({
      netTiyin: -500_000,
      kind: 'advance',
      magnitudeTiyin: 500_000,
    });
  });

  it('classifies zero as settled', () => {
    expect(describeDebt(0)).toEqual({
      netTiyin: 0,
      kind: 'settled',
      magnitudeTiyin: 0,
    });
  });
});

import { describe, expect, it } from 'vitest';

import { computeDebtTiyin } from './debt';
import {
  countUnpriced,
  handoverTotalTiyin,
  isHandoverEligible,
  type HandoverTrack,
} from './handover';
import type { TrackStatus } from '../status';

function track(
  status: TrackStatus,
  priceTiyin: number | null = 100_000_00,
  deletedAt: Date | null = null,
): HandoverTrack {
  return { currentStatus: status, priceTiyin, deletedAt };
}

describe('isHandoverEligible', () => {
  it('accepts the two Tashkent statuses and nothing else', () => {
    expect(isHandoverEligible(track('READY_FOR_PICKUP'))).toBe(true);
    expect(isHandoverEligible(track('TASHKENT_WAREHOUSE'))).toBe(true);
    for (const s of [
      'CREATED',
      'CHINA_WAREHOUSE',
      'IN_TRANSIT',
      'DELIVERED',
      'LOST',
      'RETURNED',
    ] as TrackStatus[]) {
      expect(isHandoverEligible(track(s))).toBe(false);
    }
  });

  it('never offers a soft-deleted parcel', () => {
    expect(
      isHandoverEligible(track('READY_FOR_PICKUP', 100, new Date())),
    ).toBe(false);
  });
});

describe('handoverTotalTiyin', () => {
  it('sums prices, an unpriced parcel counting as 0', () => {
    const sel = [
      track('READY_FOR_PICKUP', 150_000_00),
      track('TASHKENT_WAREHOUSE', 50_000_00),
      track('READY_FOR_PICKUP', null),
    ];
    expect(handoverTotalTiyin(sel)).toBe(200_000_00);
    expect(countUnpriced(sel)).toBe(1);
  });

  it('is 0 for an empty selection', () => {
    expect(handoverTotalTiyin([])).toBe(0);
    expect(countUnpriced([])).toBe(0);
  });

  it('agrees with the debt aggregate once the parcels are DELIVERED and paid', () => {
    // Paying exactly the pre-filled total must settle those parcels: after
    // handover they are DELIVERED (owed) and the payment offsets them.
    const sel = [
      track('READY_FOR_PICKUP', 150_000_00),
      track('READY_FOR_PICKUP', null),
    ];
    const paid = handoverTotalTiyin(sel);
    const debtAfter = computeDebtTiyin(
      sel.map((t) => ({ ...t, currentStatus: 'DELIVERED' as TrackStatus })),
      [{ amountTiyin: paid }],
    );
    expect(debtAfter).toBe(0);
  });
});

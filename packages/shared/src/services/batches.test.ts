import { describe, expect, it } from 'vitest';

import {
  BATCH_STATUSES,
  isBatchStatus,
  planBatchPropagation,
  type BatchMemberTrack,
} from './batches';

describe('BATCH_STATUSES / isBatchStatus (SPEC §7.10)', () => {
  it('is exactly the three warehouse/transit statuses', () => {
    expect([...BATCH_STATUSES]).toEqual([
      'CHINA_WAREHOUSE',
      'IN_TRANSIT',
      'TASHKENT_WAREHOUSE',
    ]);
  });

  it('rejects terminal + CREATED as batch statuses', () => {
    expect(isBatchStatus('IN_TRANSIT')).toBe(true);
    expect(isBatchStatus('CREATED')).toBe(false);
    expect(isBatchStatus('READY_FOR_PICKUP')).toBe(false);
    expect(isBatchStatus('DELIVERED')).toBe(false);
    expect(isBatchStatus('LOST')).toBe(false);
  });
});

describe('planBatchPropagation (SPEC §7.10)', () => {
  const member = (over: Partial<BatchMemberTrack>): BatchMemberTrack => ({
    id: 'x',
    currentStatus: 'CHINA_WAREHOUSE',
    customerId: 'cust',
    deletedAt: null,
    ...over,
  });

  it('advances a live non-terminal member and notifies its customer', () => {
    const plan = planBatchPropagation('IN_TRANSIT', [
      member({ id: 't1', currentStatus: 'CHINA_WAREHOUSE', customerId: 'c1' }),
    ]);
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0]).toMatchObject({
      trackId: 't1',
      willEvent: true,
      willNotify: true,
    });
    expect(plan.skipped).toBe(0);
  });

  it('does not notify an unclaimed track but still changes it', () => {
    const plan = planBatchPropagation('IN_TRANSIT', [
      member({ id: 't1', currentStatus: 'CHINA_WAREHOUSE', customerId: null }),
    ]);
    expect(plan.updates[0]).toMatchObject({ willEvent: true, willNotify: false });
  });

  it('skips DELIVERED / LOST / RETURNED members', () => {
    const plan = planBatchPropagation('TASHKENT_WAREHOUSE', [
      member({ id: 'd', currentStatus: 'DELIVERED' }),
      member({ id: 'l', currentStatus: 'LOST' }),
      member({ id: 'r', currentStatus: 'RETURNED' }),
    ]);
    expect(plan.updates).toHaveLength(0);
    expect(plan.skipped).toBe(3);
  });

  it('skips soft-deleted members even when non-terminal', () => {
    const plan = planBatchPropagation('IN_TRANSIT', [
      member({ id: 'sd', currentStatus: 'CHINA_WAREHOUSE', deletedAt: new Date() }),
    ]);
    expect(plan.updates).toHaveLength(0);
    expect(plan.skipped).toBe(1);
  });

  it('treats a member already at the target status as a no-op (§2)', () => {
    const plan = planBatchPropagation('IN_TRANSIT', [
      member({ id: 'same', currentStatus: 'IN_TRANSIT' }),
    ]);
    expect(plan.updates).toHaveLength(0);
    expect(plan.skipped).toBe(1);
  });

  it('mixes changed, skipped-terminal and skipped-deleted correctly', () => {
    const plan = planBatchPropagation('IN_TRANSIT', [
      member({ id: 'a', currentStatus: 'CHINA_WAREHOUSE', customerId: 'c1' }),
      member({ id: 'b', currentStatus: 'DELIVERED' }),
      member({ id: 'c', currentStatus: 'CHINA_WAREHOUSE', deletedAt: new Date() }),
      member({ id: 'd', currentStatus: 'CREATED', customerId: null }),
    ]);
    expect(plan.updates.map((u) => u.trackId).sort()).toEqual(['a', 'd']);
    expect(plan.skipped).toBe(2);
  });
});

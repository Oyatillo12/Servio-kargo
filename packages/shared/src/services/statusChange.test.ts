import { describe, expect, it } from 'vitest';

import { BULK_CHUNK, chunked } from './bulk';
import {
  planBulkStatusChange,
  planStatusChange,
  type BulkStatusRow,
} from './statusChange';

describe('planStatusChange', () => {
  const CUST = 'cust-1';

  it('no-ops a same-status write on a live, attached track', () => {
    expect(
      planStatusChange({
        previousStatus: 'IN_TRANSIT',
        newStatus: 'IN_TRANSIT',
        customerId: CUST,
        wasDeleted: false,
      }),
    ).toEqual({ willWrite: false, willEvent: false, willNotify: false });
  });

  it('writes, events and notifies on a real change for an attached track', () => {
    expect(
      planStatusChange({
        previousStatus: 'CHINA_WAREHOUSE',
        newStatus: 'IN_TRANSIT',
        customerId: CUST,
        wasDeleted: false,
      }),
    ).toEqual({ willWrite: true, willEvent: true, willNotify: true });
  });

  it('does not notify a change on an unclaimed track, but still writes + events', () => {
    expect(
      planStatusChange({
        previousStatus: 'CHINA_WAREHOUSE',
        newStatus: 'IN_TRANSIT',
        customerId: null,
        wasDeleted: false,
      }),
    ).toEqual({ willWrite: true, willEvent: true, willNotify: false });
  });

  it('never notifies when moving into CREATED (no §4.2 template)', () => {
    expect(
      planStatusChange({
        previousStatus: 'CHINA_WAREHOUSE',
        newStatus: 'CREATED',
        customerId: CUST,
        wasDeleted: false,
      }),
    ).toMatchObject({ willWrite: true, willEvent: true, willNotify: false });
  });

  it('revives a soft-deleted row even when the status is unchanged (no event/notify)', () => {
    expect(
      planStatusChange({
        previousStatus: 'IN_TRANSIT',
        newStatus: 'IN_TRANSIT',
        customerId: CUST,
        wasDeleted: true,
      }),
    ).toEqual({ willWrite: true, willEvent: false, willNotify: false });
  });

  it('notifies backward status corrections too (mistake fixes, §7.2)', () => {
    expect(
      planStatusChange({
        previousStatus: 'READY_FOR_PICKUP',
        newStatus: 'IN_TRANSIT',
        customerId: CUST,
        wasDeleted: false,
      }),
    ).toMatchObject({ willEvent: true, willNotify: true });
  });
});

describe('planBulkStatusChange', () => {
  const row = (over: Partial<BulkStatusRow> & { id: string }): BulkStatusRow => ({
    currentStatus: 'CHINA_WAREHOUSE',
    customerId: null,
    deletedAt: null,
    ...over,
  });

  it('plans nothing for an empty selection', () => {
    expect(planBulkStatusChange('IN_TRANSIT', [])).toEqual({
      writeIds: [],
      eventIds: [],
      notify: [],
      skipped: 0,
    });
  });

  it('splits a mixed selection into writes, events and notifications', () => {
    const plan = planBulkStatusChange('IN_TRANSIT', [
      row({ id: 'a', customerId: 'c1' }), // real change, attached → notify
      row({ id: 'b' }), // real change, unclaimed → no notify
      row({ id: 'c', currentStatus: 'IN_TRANSIT', customerId: 'c2' }), // §2 no-op
      row({ id: 'd', currentStatus: 'IN_TRANSIT', deletedAt: new Date() }), // revive
    ]);

    expect(plan.writeIds).toEqual(['a', 'b', 'd']);
    expect(plan.eventIds).toEqual(['a', 'b']);
    expect(plan.notify).toEqual([{ trackId: 'a', customerId: 'c1' }]);
    expect(plan.skipped).toBe(1);
  });

  it('never notifies into CREATED, even for attached tracks', () => {
    const plan = planBulkStatusChange('CREATED', [
      row({ id: 'a', customerId: 'c1' }),
    ]);
    expect(plan.writeIds).toEqual(['a']);
    expect(plan.eventIds).toEqual(['a']);
    expect(plan.notify).toEqual([]);
  });

  it('agrees with planStatusChange row by row', () => {
    const rows = [
      row({ id: 'a', customerId: 'c1' }),
      row({ id: 'b', currentStatus: 'READY_FOR_PICKUP', customerId: 'c2' }),
      row({ id: 'c', currentStatus: 'IN_TRANSIT' }),
      row({ id: 'd', deletedAt: new Date(), customerId: 'c3' }),
    ];
    const plan = planBulkStatusChange('IN_TRANSIT', rows);

    for (const r of rows) {
      const single = planStatusChange({
        previousStatus: r.currentStatus,
        newStatus: 'IN_TRANSIT',
        customerId: r.customerId,
        wasDeleted: r.deletedAt != null,
      });
      expect(plan.writeIds.includes(r.id)).toBe(single.willWrite);
      expect(plan.eventIds.includes(r.id)).toBe(single.willEvent);
      expect(plan.notify.some((n) => n.trackId === r.id)).toBe(single.willNotify);
    }
  });

  // AUDIT.md T7: a full flight flipped in one go must stay within the Postgres
  // bind-parameter budget instead of costing a statement pair per track.
  describe('2 500 tracks', () => {
    const rows = Array.from({ length: 2500 }, (_, i) =>
      row({
        id: `track-${i}`,
        currentStatus: i % 5 === 0 ? 'IN_TRANSIT' : 'CHINA_WAREHOUSE',
        customerId: i % 2 === 0 ? `cust-${i}` : null,
      }),
    );
    const plan = planBulkStatusChange('IN_TRANSIT', rows);

    it('skips only the rows already at the target status', () => {
      expect(plan.skipped).toBe(500);
      expect(plan.writeIds).toHaveLength(2000);
      expect(plan.eventIds).toHaveLength(2000);
      // Attached AND actually changing: the 1250 even-indexed rows minus the
      // 250 of them that were already IN_TRANSIT (i % 10 === 0).
      expect(plan.notify).toHaveLength(1250 - 250);
    });

    it('chunks every statement under the parameter cap', () => {
      const updateChunks = chunked(plan.writeIds);
      const eventChunks = chunked(plan.eventIds);
      expect(updateChunks).toHaveLength(2);
      expect(eventChunks).toHaveLength(2);
      for (const chunk of [...updateChunks, ...eventChunks]) {
        expect(chunk.length).toBeLessThanOrEqual(BULK_CHUNK);
      }
      // 2000 tracks: 2 UPDATEs + 2 event INSERTs, not 2000 statement pairs.
      expect(updateChunks.length + eventChunks.length).toBe(4);
    });

    it('lists every notification exactly once, with its own customer', () => {
      const ids = plan.notify.map((n) => n.trackId);
      expect(new Set(ids).size).toBe(ids.length);
      for (const n of plan.notify) {
        expect(n.customerId).toBe(`cust-${n.trackId.slice('track-'.length)}`);
      }
    });
  });
});

import { describe, expect, it } from 'vitest';

import {
  BROADCAST_HOLD_SECONDS,
  broadcastHoldRemainingMs,
  canStopBroadcast,
  isBroadcastTest,
  type BroadcastJob,
} from './broadcast';

describe('isBroadcastTest (SPEC §5.8, tasks.md K1)', () => {
  it('recognises a test by its chat id', () => {
    const test: BroadcastJob = { tenantId: 't1', text: 'hi', testChatId: 42 };
    expect(isBroadcastTest(test)).toBe(true);
  });

  it('treats a fan-out delivery as a real one', () => {
    const fanout: BroadcastJob = {
      tenantId: 't1',
      broadcastId: 'b1',
      customerId: 'c1',
      text: 'hi',
    };
    expect(isBroadcastTest(fanout)).toBe(false);
  });

  it('reads a job enqueued before K1 as a fan-out', () => {
    // Deploy safety: jobs already in the queue have no `testChatId` field at
    // all, and must not be mistaken for a test (which skips the log + count).
    const legacy = JSON.parse(
      '{"tenantId":"t1","broadcastId":"b1","customerId":"c1","text":"hi"}',
    ) as BroadcastJob;
    expect(isBroadcastTest(legacy)).toBe(false);
  });
});

describe('broadcastHoldRemainingMs (SPEC §7.11, D-008)', () => {
  const created = new Date('2026-08-16T10:00:00Z');

  it('counts the window down from the moment it was queued', () => {
    expect(
      broadcastHoldRemainingMs(created, new Date('2026-08-16T10:00:00Z')),
    ).toBe(BROADCAST_HOLD_SECONDS * 1000);
    expect(
      broadcastHoldRemainingMs(created, new Date('2026-08-16T10:00:20Z')),
    ).toBe(40_000);
  });

  it('never goes negative once the window has closed', () => {
    expect(
      broadcastHoldRemainingMs(created, new Date('2026-08-16T10:05:00Z')),
    ).toBe(0);
  });

  it('is zero — not negative — exactly at the boundary', () => {
    expect(
      broadcastHoldRemainingMs(created, new Date('2026-08-16T10:01:00Z')),
    ).toBe(0);
  });
});

describe('canStopBroadcast (SPEC §5.8)', () => {
  it('offers the stop while deliveries are outstanding', () => {
    expect(
      canStopBroadcast({ status: 'queued', sentCount: 0, recipientCount: 300 }),
    ).toBe(true);
    expect(
      canStopBroadcast({ status: 'queued', sentCount: 299, recipientCount: 300 }),
    ).toBe(true);
  });

  it('offers nothing once the fan-out is finished', () => {
    // A button that says "stop" and stops nothing is worse than no button.
    expect(
      canStopBroadcast({ status: 'queued', sentCount: 300, recipientCount: 300 }),
    ).toBe(false);
  });

  it('offers nothing on an already-cancelled broadcast', () => {
    expect(
      canStopBroadcast({
        status: 'cancelled',
        sentCount: 12,
        recipientCount: 300,
      }),
    ).toBe(false);
  });

  it('offers nothing on a legacy row with no recipient count', () => {
    // Rows that predate the column are backfilled to sent = recipients, so a
    // broadcast from last month never renders a live stop button.
    expect(
      canStopBroadcast({ status: 'queued', sentCount: 12, recipientCount: 12 }),
    ).toBe(false);
  });
});

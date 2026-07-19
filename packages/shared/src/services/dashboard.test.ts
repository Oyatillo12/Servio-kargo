import { describe, expect, it } from 'vitest';

import {
  bucketDailyTushum,
  lastNDays,
  periodRange,
  tashkentDateKey,
} from './dashboard';

// Asia/Tashkent is a fixed UTC+5, so a Tashkent calendar day runs from
// 19:00 UTC (previous day) to 19:00 UTC. We assert on that boundary throughout.

describe('tashkentDateKey (§7.9)', () => {
  it('projects an instant onto its Asia/Tashkent (UTC+5) calendar day', () => {
    // 18:30Z → 23:30 Tashkent, still 2026-07-20.
    expect(tashkentDateKey(new Date('2026-07-20T18:30:00Z'))).toBe('2026-07-20');
    // 19:30Z → 00:30 Tashkent, already 2026-07-21.
    expect(tashkentDateKey(new Date('2026-07-20T19:30:00Z'))).toBe('2026-07-21');
  });
});

describe('periodRange (§5.10)', () => {
  it('"today" is the single Tashkent day [19:00Z prev, 19:00Z today)', () => {
    const { startUtc, endUtc } = periodRange(
      new Date('2026-07-20T10:00:00Z'),
      'today',
    );
    expect(startUtc.toISOString()).toBe('2026-07-19T19:00:00.000Z');
    expect(endUtc.toISOString()).toBe('2026-07-20T19:00:00.000Z');
  });

  it('"7d" reaches back 7 Tashkent days (today + 6 prior)', () => {
    const { startUtc, endUtc } = periodRange(
      new Date('2026-07-20T10:00:00Z'),
      '7d',
    );
    // End = start of 2026-07-21 Tashkent; start = 7 days earlier.
    expect(endUtc.toISOString()).toBe('2026-07-20T19:00:00.000Z');
    expect(startUtc.toISOString()).toBe('2026-07-13T19:00:00.000Z');
    expect((endUtc.getTime() - startUtc.getTime()) / 86_400_000).toBe(7);
  });

  it('"30d" spans 30 Tashkent days', () => {
    const { startUtc, endUtc } = periodRange(
      new Date('2026-07-20T10:00:00Z'),
      '30d',
    );
    expect((endUtc.getTime() - startUtc.getTime()) / 86_400_000).toBe(30);
    expect(endUtc.toISOString()).toBe('2026-07-20T19:00:00.000Z');
  });

  it('resolves the UTC↔Tashkent midnight edge: same UTC date, different windows', () => {
    // 18:30Z is still Tashkent 2026-07-20 → today = the 07-20 window.
    const before = periodRange(new Date('2026-07-20T18:30:00Z'), 'today');
    expect(before.startUtc.toISOString()).toBe('2026-07-19T19:00:00.000Z');
    expect(before.endUtc.toISOString()).toBe('2026-07-20T19:00:00.000Z');

    // 19:30Z has rolled into Tashkent 2026-07-21 → today = the 07-21 window,
    // even though the UTC calendar date is unchanged.
    const after = periodRange(new Date('2026-07-20T19:30:00Z'), 'today');
    expect(after.startUtc.toISOString()).toBe('2026-07-20T19:00:00.000Z');
    expect(after.endUtc.toISOString()).toBe('2026-07-21T19:00:00.000Z');
  });
});

describe('lastNDays (§5.10 chart)', () => {
  it('returns n ordered, distinct, contiguous Tashkent days ending today', () => {
    const days = lastNDays(new Date('2026-07-20T10:00:00Z'), 14);
    expect(days).toHaveLength(14);
    expect(days[0]!.dateKey).toBe('2026-07-07');
    expect(days[13]!.dateKey).toBe('2026-07-20');

    const keys = new Set(days.map((d) => d.dateKey));
    expect(keys.size).toBe(14);
    // Contiguous: each bucket's end is the next bucket's start.
    for (let i = 1; i < days.length; i += 1) {
      expect(days[i]!.startUtc.getTime()).toBe(days[i - 1]!.endUtc.getTime());
    }
  });

  it('anchors "today" by the Tashkent day, not the UTC day (midnight edge)', () => {
    const days = lastNDays(new Date('2026-07-20T19:30:00Z'), 14);
    expect(days[13]!.dateKey).toBe('2026-07-21');
  });
});

describe('bucketDailyTushum (§5.10 chart)', () => {
  const buckets = lastNDays(new Date('2026-07-20T10:00:00Z'), 14);

  it('sums payments into their Tashkent-day column and zero-fills empties', () => {
    const points = bucketDailyTushum(buckets, [
      { amountTiyin: 100_000, createdAt: new Date('2026-07-20T05:00:00Z') },
      { amountTiyin: 50_000, createdAt: new Date('2026-07-20T14:00:00Z') },
      // 18:30Z belongs to Tashkent 07-20; 19:30Z would spill to 07-21.
      { amountTiyin: 25_000, createdAt: new Date('2026-07-20T18:30:00Z') },
    ]);
    const today = points.find((p) => p.dateKey === '2026-07-20');
    expect(today!.totalTiyin).toBe(175_000);
    const empty = points.find((p) => p.dateKey === '2026-07-10');
    expect(empty!.totalTiyin).toBe(0);
  });

  it('ignores payments outside the bucket span', () => {
    const points = bucketDailyTushum(buckets, [
      // Before the window (07-06) and after it (07-21 Tashkent).
      { amountTiyin: 999, createdAt: new Date('2026-07-06T10:00:00Z') },
      { amountTiyin: 999, createdAt: new Date('2026-07-20T19:30:00Z') },
    ]);
    expect(points.reduce((s, p) => s + p.totalTiyin, 0)).toBe(0);
  });
});

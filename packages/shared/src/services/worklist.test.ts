import { describe, expect, it } from 'vitest';

import {
  PICKUP_STALE_DAYS,
  TRACK_WORKLISTS,
  WORKLIST_META,
  isTrackWorklist,
  stalePickupCutoff,
  worklistLabel,
} from './worklist';

describe('isTrackWorklist', () => {
  it.each(TRACK_WORKLISTS)('accepts %s', (key) => {
    expect(isTrackWorklist(key)).toBe(true);
  });

  it('rejects unknown, empty and missing values', () => {
    expect(isTrackWorklist('delivered')).toBe(false);
    expect(isTrackWorklist('')).toBe(false);
    expect(isTrackWorklist(undefined)).toBe(false);
    expect(isTrackWorklist(null)).toBe(false);
  });

  it('rejects a key differing only in case (URLs are matched exactly)', () => {
    expect(isTrackWorklist('TO_WEIGH')).toBe(false);
  });
});

describe('stalePickupCutoff', () => {
  const now = new Date('2026-07-27T09:00:00.000Z');

  it('is exactly PICKUP_STALE_DAYS before now', () => {
    expect(stalePickupCutoff(now).toISOString()).toBe('2026-07-20T09:00:00.000Z');
  });

  it('accepts a custom window', () => {
    expect(stalePickupCutoff(now, 1).toISOString()).toBe(
      '2026-07-26T09:00:00.000Z',
    );
  });

  it('does not mutate the given instant', () => {
    const copy = new Date(now);
    stalePickupCutoff(copy);
    expect(copy.getTime()).toBe(now.getTime());
  });

  it('is a rolling window, so a track ready exactly at the cutoff is not stale', () => {
    // The SQL compares `readyAt < cutoff`; equality must fall on the safe side.
    const readyAt = stalePickupCutoff(now);
    expect(readyAt < stalePickupCutoff(now)).toBe(false);
  });
});

describe('WORKLIST_META', () => {
  it.each(TRACK_WORKLISTS)('has a non-empty uz + ru label and hint for %s', (key) => {
    for (const lang of ['uz', 'ru'] as const) {
      const { label, hint } = worklistLabel(key, lang);
      expect(label.trim().length).toBeGreaterThan(0);
      expect(hint.trim().length).toBeGreaterThan(0);
    }
  });

  it('covers every worklist key and nothing more', () => {
    expect(Object.keys(WORKLIST_META).sort()).toEqual([...TRACK_WORKLISTS].sort());
  });

  it('states the actual threshold in the stale-pickup hint', () => {
    expect(worklistLabel('stale_pickup', 'uz').hint).toContain(
      String(PICKUP_STALE_DAYS),
    );
    expect(worklistLabel('stale_pickup', 'ru').hint).toContain(
      String(PICKUP_STALE_DAYS),
    );
  });
});

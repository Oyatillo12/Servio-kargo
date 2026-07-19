import { describe, expect, it } from 'vitest';

import type { TrackStatus } from '../status';
import { paginate, sortForDisplay } from './myTracks';

const mk = (status: TrackStatus, iso: string) => ({
  currentStatus: status,
  createdAt: new Date(iso),
});

describe('sortForDisplay', () => {
  it('orders by pipeline status then createdAt (oldest first)', () => {
    const tracks = [
      mk('DELIVERED', '2026-01-05'),
      mk('CREATED', '2026-01-03'),
      mk('CREATED', '2026-01-01'),
      mk('IN_TRANSIT', '2026-01-02'),
    ];
    const sorted = sortForDisplay(tracks).map(
      (t) => `${t.currentStatus}@${t.createdAt.toISOString().slice(0, 10)}`,
    );
    expect(sorted).toEqual([
      'CREATED@2026-01-01',
      'CREATED@2026-01-03',
      'IN_TRANSIT@2026-01-02',
      'DELIVERED@2026-01-05',
    ]);
  });

  it('places LOST/RETURNED side-states after the pipeline', () => {
    const tracks = [
      mk('LOST', '2026-01-01'),
      mk('READY_FOR_PICKUP', '2026-01-01'),
    ];
    expect(sortForDisplay(tracks).map((t) => t.currentStatus)).toEqual([
      'READY_FOR_PICKUP',
      'LOST',
    ]);
  });

  it('does not mutate the input array', () => {
    const tracks = [mk('DELIVERED', '2026-01-02'), mk('CREATED', '2026-01-01')];
    const before = tracks.map((t) => t.currentStatus);
    sortForDisplay(tracks);
    expect(tracks.map((t) => t.currentStatus)).toEqual(before);
  });
});

describe('paginate (10 per page)', () => {
  const items = Array.from({ length: 23 }, (_, i) => i + 1);

  it('returns the first page and correct page count', () => {
    const p = paginate(items, 1);
    expect(p.slice).toHaveLength(10);
    expect(p.slice[0]).toBe(1);
    expect(p.pages).toBe(3);
    expect(p.total).toBe(23);
    expect(p.page).toBe(1);
  });

  it('returns the last partial page', () => {
    const p = paginate(items, 3);
    expect(p.slice).toEqual([21, 22, 23]);
  });

  it('clamps out-of-range pages into [1, pages]', () => {
    expect(paginate(items, 99).page).toBe(3);
    expect(paginate(items, 0).page).toBe(1);
    expect(paginate(items, -5).page).toBe(1);
  });

  it('always reports at least one page for an empty list', () => {
    const p = paginate([], 1);
    expect(p.slice).toEqual([]);
    expect(p.pages).toBe(1);
    expect(p.total).toBe(0);
  });

  it('respects a custom page size', () => {
    expect(paginate(items, 1, 5).slice).toHaveLength(5);
    expect(paginate(items, 1, 5).pages).toBe(5);
  });
});

/**
 * "My tracks" display helpers (SPEC §3.3): order tracks by pipeline status then
 * age, and paginate 10 per page. Pure functions — the caller fetches the
 * tenant-scoped, non-deleted tracks and renders the resulting slice.
 */

import { statusSortIndex, type TrackStatus } from '../status';

export interface SortableTrack {
  currentStatus: TrackStatus;
  createdAt: Date;
}

/** Sort by pipeline order (SPEC §3.3), oldest first within a status. */
export function sortForDisplay<T extends SortableTrack>(tracks: T[]): T[] {
  return [...tracks].sort(
    (a, b) =>
      statusSortIndex(a.currentStatus) - statusSortIndex(b.currentStatus) ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  );
}

export interface Page<T> {
  slice: T[];
  /** 1-based, clamped into range. */
  page: number;
  /** Total pages, always ≥ 1. */
  pages: number;
  total: number;
}

export const MY_TRACKS_PAGE_SIZE = 10;

/**
 * Slice `items` into a 1-based page. `page` is clamped to `[1, pages]` so an
 * out-of-range inline-button callback never returns an empty slice by mistake.
 */
export function paginate<T>(
  items: T[],
  page: number,
  size: number = MY_TRACKS_PAGE_SIZE,
): Page<T> {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const clamped = Math.min(Math.max(1, Math.trunc(page)), pages);
  const start = (clamped - 1) * size;
  return {
    slice: items.slice(start, start + size),
    page: clamped,
    pages,
    total,
  };
}

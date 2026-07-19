/**
 * Track status pipeline + display metadata (SPEC §2, CLAUDE.md rule 7).
 *
 * This is the canonical source of the status set for the whole codebase. The
 * Drizzle `track_status` pgEnum in `@kargotrack/db` mirrors these values in the
 * same order — keep them in sync. `shared` never imports from `db` (that would
 * create a dependency cycle), so the type lives here.
 */

/** Fixed pipeline order followed by terminal side-states. */
export const TRACK_STATUSES = [
  'CREATED',
  'CHINA_WAREHOUSE',
  'IN_TRANSIT',
  'TASHKENT_WAREHOUSE',
  'READY_FOR_PICKUP',
  'DELIVERED',
  'LOST',
  'RETURNED',
] as const;

export type TrackStatus = (typeof TRACK_STATUSES)[number];

/** The linear pipeline (excludes the LOST/RETURNED side-states). */
export const PIPELINE_ORDER = [
  'CREATED',
  'CHINA_WAREHOUSE',
  'IN_TRANSIT',
  'TASHKENT_WAREHOUSE',
  'READY_FOR_PICKUP',
  'DELIVERED',
] as const satisfies readonly TrackStatus[];

/**
 * Terminal statuses (SPEC §7.10): a track here is "done" and is skipped by batch
 * status propagation. DELIVERED is a completed pickup; LOST/RETURNED are the
 * side-states.
 */
export const TERMINAL_STATUSES = new Set<TrackStatus>([
  'DELIVERED',
  'LOST',
  'RETURNED',
]);

/** Whether a status is terminal (see {@link TERMINAL_STATUSES}). */
export function isTerminalStatus(status: TrackStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

/** Per-status uz/ru labels + emoji from the SPEC §2 table. */
export const STATUS_META: Record<
  TrackStatus,
  { uz: string; ru: string; emoji: string }
> = {
  CREATED: { uz: "Ro'yxatga olindi", ru: 'Зарегистрирован', emoji: '📝' },
  CHINA_WAREHOUSE: {
    uz: 'Xitoy omborida',
    ru: 'На складе в Китае',
    emoji: '📦',
  },
  IN_TRANSIT: { uz: "Yo'lda", ru: 'В пути', emoji: '🚚' },
  TASHKENT_WAREHOUSE: {
    uz: 'Toshkent omborida',
    ru: 'На складе в Ташкенте',
    emoji: '🇺🇿',
  },
  READY_FOR_PICKUP: {
    uz: 'Olib ketishga tayyor',
    ru: 'Готов к выдаче',
    emoji: '✅',
  },
  DELIVERED: { uz: 'Topshirildi', ru: 'Выдан', emoji: '🎉' },
  LOST: { uz: "Yo'qolgan", ru: 'Утерян', emoji: '⚠️' },
  RETURNED: { uz: 'Qaytarildi', ru: 'Возврат', emoji: '↩️' },
};

/**
 * Sort index used to order tracks for display (SPEC §3.3 "pipeline order").
 * Matches the declaration order in {@link TRACK_STATUSES}: the six pipeline
 * statuses first, then the LOST / RETURNED side-states.
 */
export function statusSortIndex(status: TrackStatus): number {
  return TRACK_STATUSES.indexOf(status);
}

/**
 * Operational worklists — the "what needs doing right now" queues (AUDIT.md
 * T19).
 *
 * The dashboard used to answer "how did the month go"; at 9:00 an admin needs
 * the opposite: what arrived, what has to be weighed, what nobody has claimed,
 * what has been sitting on the shelf for a week. Each worklist is one saved
 * filter over `tracks`, shown as a counted row on the dashboard and reachable
 * on the tracks list as `?work=<key>` — the count and the list are built from
 * the SAME condition (see `apps/web/lib/queries/track-filter.ts`), so the two
 * can never disagree.
 *
 * Pure and framework-free: keys, labels (uz + ru) and the staleness threshold.
 * The SQL lives in the panel.
 */

import type { Lang } from '../i18n';

export const TRACK_WORKLISTS = ['unassigned', 'to_weigh', 'stale_pickup'] as const;

export type TrackWorklist = (typeof TRACK_WORKLISTS)[number];

/** Narrow an untrusted query-string value to a worklist key. */
export function isTrackWorklist(v: string | undefined | null): v is TrackWorklist {
  return v != null && (TRACK_WORKLISTS as readonly string[]).includes(v);
}

/**
 * How long a READY_FOR_PICKUP track may sit before it counts as "not picked
 * up". Seven days is what owners chase on: shorter and every Friday-to-Monday
 * package raises a flag, longer and the shelf is already full.
 */
export const PICKUP_STALE_DAYS = 7;

const DAY_MS = 86_400_000;

/**
 * The instant a track must have become READY_FOR_PICKUP *before* to count as
 * stale. A plain rolling window, not a Tashkent calendar day: "sitting for a
 * week" is a duration, so it needs no timezone (§7.9 applies to day buckets).
 */
export function stalePickupCutoff(now: Date, days: number = PICKUP_STALE_DAYS): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

export interface WorklistLabel {
  /** Row title, e.g. "Tortish kerak". */
  label: string;
  /** One-line explanation of what the filter selects. */
  hint: string;
}

/**
 * Display strings per worklist. Both languages are carried even though the
 * panel is Uzbek-only today (AUDIT.md T17 moves it to `admin_users.lang`) —
 * adding the pair now costs nothing and keeps CLAUDE.md rule 5 honest.
 */
export const WORKLIST_META: Record<TrackWorklist, Record<Lang, WorklistLabel>> = {
  unassigned: {
    uz: { label: 'Biriktirilmagan', hint: 'Mijozi topilmagan treklar' },
    ru: { label: 'Без клиента', hint: 'Посылки без владельца' },
  },
  to_weigh: {
    uz: { label: 'Tortish kerak', hint: "Xitoy omborida, og'irligi yo'q" },
    ru: { label: 'Нужно взвесить', hint: 'На складе в Китае, без веса' },
  },
  stale_pickup: {
    uz: {
      label: 'Olib ketilmagan',
      hint: `${PICKUP_STALE_DAYS} kundan beri tayyor`,
    },
    ru: {
      label: 'Не забрали',
      hint: `Готово более ${PICKUP_STALE_DAYS} дней`,
    },
  },
};

/** Label + hint for a worklist in the given language. */
export function worklistLabel(key: TrackWorklist, lang: Lang): WorklistLabel {
  return WORKLIST_META[key][lang];
}

/**
 * Status styling for the admin panel. Labels + emoji come from the canonical
 * `STATUS_META` in `@kargotrack/shared` (SPEC §2); the colours are the `--st-*`
 * tokens in `app/globals.css`, one hue per pipeline stage (SPEC 5.0).
 *
 * Nothing here is a hex literal: a status is a state, and every state in
 * TERMINAL has to be nameable from one place — the same tokens dress the badge,
 * the timeline dot and the route rail.
 *
 * Status names are deliberately NOT duplicated into `messages/{uz,ru}.json`:
 * they are domain vocabulary the bot sends to customers too, and two copies
 * would drift the moment one side is edited. The panel passes its next-intl
 * locale in and reads the same table the bot does.
 */

import { STATUS_META, type Lang, type TrackStatus } from '@kargotrack/shared';

/**
 * Ground + ink per status. Spelled out rather than built from a stem because
 * Tailwind reads this file as TEXT: a class assembled at runtime is a class
 * that never reaches the stylesheet.
 */
const STATUS_CLASS: Record<TrackStatus, string> = {
  CREATED: 'bg-[var(--st-created-bg)] text-[var(--st-created)]',
  CHINA_WAREHOUSE: 'bg-[var(--st-china-bg)] text-[var(--st-china)]',
  IN_TRANSIT: 'bg-[var(--st-transit-bg)] text-[var(--st-transit)]',
  TASHKENT_WAREHOUSE: 'bg-[var(--st-tashkent-bg)] text-[var(--st-tashkent)]',
  READY_FOR_PICKUP: 'bg-[var(--st-ready-bg)] text-[var(--st-ready)]',
  DELIVERED: 'bg-[var(--st-delivered-bg)] text-[var(--st-delivered)]',
  LOST: 'bg-[var(--st-lost-bg)] text-[var(--st-lost)]',
  RETURNED: 'bg-[var(--st-returned-bg)] text-[var(--st-returned)]',
};

/** Solid accent per status (timeline dots, route rail, the badge's bar). */
const STATUS_DOT: Record<TrackStatus, string> = {
  CREATED: 'var(--st-created)',
  CHINA_WAREHOUSE: 'var(--st-china)',
  IN_TRANSIT: 'var(--st-transit)',
  TASHKENT_WAREHOUSE: 'var(--st-tashkent)',
  READY_FOR_PICKUP: 'var(--st-ready)',
  DELIVERED: 'var(--st-delivered)',
  LOST: 'var(--st-lost)',
  RETURNED: 'var(--st-returned)',
};

export interface StatusView {
  label: string;
  emoji: string;
  /** Ground + ink for the badge, driven by the tokens above. */
  className: string;
  /** Solid colour for timeline dots, rail segments and the badge's bar. */
  dot: string;
}

export function statusView(status: TrackStatus, lang: Lang): StatusView {
  return {
    label: STATUS_META[status][lang],
    emoji: STATUS_META[status].emoji,
    className: STATUS_CLASS[status],
    dot: STATUS_DOT[status],
  };
}

/** `📦 Xitoy omborida` — the emoji + label pairing used in every status picker. */
export function statusOptionLabel(status: TrackStatus, lang: Lang): string {
  return `${STATUS_META[status].emoji} ${STATUS_META[status][lang]}`;
}

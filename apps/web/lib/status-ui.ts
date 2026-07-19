/**
 * Status badge styling for the admin panel. Labels + emoji come from the
 * canonical `STATUS_META` in `@kargotrack/shared` (SPEC §2); only the Tailwind
 * colour classes live here.
 */

import { STATUS_META, type TrackStatus } from '@kargotrack/shared';

/** Tailwind bg/text classes per status (colored badge, SPEC §5.2). */
const STATUS_CLASS: Record<TrackStatus, string> = {
  CREATED: 'bg-slate-100 text-slate-700 ring-slate-200',
  CHINA_WAREHOUSE: 'bg-blue-100 text-blue-800 ring-blue-200',
  IN_TRANSIT: 'bg-amber-100 text-amber-800 ring-amber-200',
  TASHKENT_WAREHOUSE: 'bg-cyan-100 text-cyan-800 ring-cyan-200',
  READY_FOR_PICKUP: 'bg-green-100 text-green-800 ring-green-200',
  DELIVERED: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  LOST: 'bg-red-100 text-red-800 ring-red-200',
  RETURNED: 'bg-orange-100 text-orange-800 ring-orange-200',
};

export interface StatusView {
  label: string;
  emoji: string;
  className: string;
}

export function statusView(status: TrackStatus): StatusView {
  return {
    label: STATUS_META[status].uz,
    emoji: STATUS_META[status].emoji,
    className: STATUS_CLASS[status],
  };
}

/**
 * Status badge styling for the admin panel. Labels + emoji come from the
 * canonical `STATUS_META` in `@kargotrack/shared` (SPEC §2); the Tailwind colour
 * classes here mirror the KargoTrack design system (design screen 17).
 */

import { STATUS_META, type TrackStatus } from '@kargotrack/shared';

/** Tailwind bg/text/border classes per status (colored badge, SPEC §5.2). */
const STATUS_CLASS: Record<TrackStatus, string> = {
  CREATED: 'bg-[#f1f3f6] text-[#4b5565] border-[#dde1e8]',
  CHINA_WAREHOUSE: 'bg-[#fdf3d8] text-[#92600a] border-[#f3e2b0]',
  IN_TRANSIT: 'bg-[#e3f2fc] text-[#086299] border-[#c4e3f6]',
  TASHKENT_WAREHOUSE: 'bg-[#efeafb] text-[#6636b8] border-[#ddd2f3]',
  READY_FOR_PICKUP: 'bg-[#e2f6e8] text-[#177338] border-[#c2e8cf]',
  DELIVERED: 'bg-[#e9f2ee] text-[#2e6b55] border-[#d2e4dc]',
  LOST: 'bg-[#fde8e8] text-[#b3261e] border-[#f5c8c6]',
  RETURNED: 'bg-[#fdeee0] text-[#ad4e10] border-[#f3d7bd]',
};

/** Solid accent colour per status (timeline dots, route rail). */
const STATUS_DOT: Record<TrackStatus, string> = {
  CREATED: '#4b5565',
  CHINA_WAREHOUSE: '#92600a',
  IN_TRANSIT: '#086299',
  TASHKENT_WAREHOUSE: '#6636b8',
  READY_FOR_PICKUP: '#177338',
  DELIVERED: '#2e6b55',
  LOST: '#b3261e',
  RETURNED: '#ad4e10',
};

export interface StatusView {
  label: string;
  emoji: string;
  className: string;
  dot: string;
}

export function statusView(status: TrackStatus): StatusView {
  return {
    label: STATUS_META[status].uz,
    emoji: STATUS_META[status].emoji,
    className: STATUS_CLASS[status],
    dot: STATUS_DOT[status],
  };
}

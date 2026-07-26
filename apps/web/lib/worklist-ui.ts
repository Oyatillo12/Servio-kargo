import type { TrackWorklist } from '@kargotrack/shared';

/**
 * Display-only bits of the operational worklists (AUDIT.md T19) — shared by the
 * dashboard block and the `/tracks?work=…` banner so a queue looks the same on
 * both screens. The labels themselves live in `@kargotrack/shared`
 * (`WORKLIST_META`, uz + ru), not here.
 */
export const WORKLIST_ICONS: Record<TrackWorklist, string> = {
  to_weigh: '⚖️',
  unassigned: '🙋',
  stale_pickup: '⏳',
};

/**
 * Presentation order: the working day (weigh what arrived → attach the
 * ownerless → chase the shelf), not the declaration order of the enum.
 */
export const WORKLIST_ORDER: readonly TrackWorklist[] = [
  'to_weigh',
  'unassigned',
  'stale_pickup',
];

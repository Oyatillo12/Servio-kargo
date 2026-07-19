import type { TrackStatus } from '@kargotrack/shared';

import { statusView } from '@/lib/status-ui';

/** Colored status pill (SPEC §5.2), Uzbek label + emoji. */
export function StatusBadge({ status }: { status: TrackStatus }) {
  const v = statusView(status);
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${v.className}`}
    >
      <span aria-hidden>{v.emoji}</span>
      {v.label}
    </span>
  );
}

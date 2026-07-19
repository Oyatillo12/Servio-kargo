import type { TrackStatus } from '@kargotrack/shared';

import { cn } from '@/lib/utils';
import { statusView } from '@/lib/status-ui';

/** Colored status pill (SPEC §5.2), Uzbek label. */
export function StatusBadge({
  status,
  className,
}: {
  status: TrackStatus;
  className?: string;
}) {
  const v = statusView(status);
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold',
        v.className,
        className,
      )}
    >
      {v.label}
    </span>
  );
}

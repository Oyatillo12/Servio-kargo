import type { Lang, TrackStatus } from '@kargotrack/shared';

import { statusView } from '@/lib/status-ui';
import { cn } from '@/lib/utils';

/**
 * TWA variant of the panel's StatusBadge: the language comes from the
 * CUSTOMER row, passed explicitly — `useLocale` would read the admin's
 * panel cookie here, which is the wrong person.
 */
export function StatusPill({
  status,
  lang,
  className,
}: {
  status: TrackStatus;
  lang: Lang;
  className?: string;
}) {
  const v = statusView(status, lang);
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

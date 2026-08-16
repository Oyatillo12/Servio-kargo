import { useLocale } from 'next-intl';

import type { Lang, TrackStatus } from '@kargotrack/shared';

import { cn } from '@/lib/utils';
import { statusView } from '@/lib/status-ui';

/**
 * The status chip (SPEC §5.2), labelled in the admin's panel language.
 *
 * A stencilled rectangle with a stripe down its left edge, not a pill: this is
 * the mark on the side of a crate. The stripe is the load-bearing half — it is
 * the same colour as the timeline dot and the rail segment for that status, so
 * a row, a history entry and a progress rail all say the stage the same way,
 * and it survives a grayscale print where two tints would not.
 *
 * Works in both Server and Client Components — `useLocale` reads next-intl's
 * request config on the server and the provider in the browser.
 */
export function StatusBadge({
  status,
  className,
}: {
  status: TrackStatus;
  className?: string;
}) {
  const locale = useLocale() as Lang;
  const v = statusView(status, locale);

  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-sm border-l-[3px] py-0.5 pe-2 ps-1.5 text-micro font-semibold',
        v.className,
        className,
      )}
      style={{ borderLeftColor: v.dot }}
    >
      {v.label}
    </span>
  );
}

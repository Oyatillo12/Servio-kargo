import { useLocale } from 'next-intl';

import type { Lang, TrackStatus } from '@kargotrack/shared';

import { cn } from '@/lib/utils';
import { statusView } from '@/lib/status-ui';

/**
 * Colored status pill (SPEC §5.2), labelled in the admin's panel language.
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
        'inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold',
        v.className,
        className,
      )}
    >
      {v.label}
    </span>
  );
}

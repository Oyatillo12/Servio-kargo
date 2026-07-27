import Link from 'next/link';
import { ChevronRight, CircleCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { worklistLabel, type Lang, type TrackWorklist } from '@kargotrack/shared';

import { PanelSection } from '@/components/ui/panel-section';
import { cn } from '@/lib/utils';
import type { WorklistCounts } from '@/lib/queries';
import { WORKLIST_ICONS, WORKLIST_ORDER } from '@/lib/worklist-ui';

/**
 * The operational queue that opens the dashboard (AUDIT.md T19, design 1a/1b).
 * The money figures report how the month went; at 9:00 the admin needs the
 * opposite: what has to be weighed, what nobody has claimed, what has been
 * sitting on the shelf for a week.
 *
 * A list of full-width rows, not a grid of tiles: three queues in a row read as
 * three unrelated stats, while stacked rows read as a to-do list you work down.
 * Each row links into `/tracks?work=…` filtered by the same condition the count
 * was made with, so tapping a number lands on exactly those tracks.
 */
export function WorkQueue({ counts }: { counts: WorklistCounts }) {
  const t = useTranslations('dashboard');
  const pending = WORKLIST_ORDER.reduce((n, key) => n + counts[key], 0);

  return (
    <PanelSection
      flush
      className="md:col-span-4"
      title={t('workQueueTitle')}
      meta={pending > 0 ? t('workQueuePending', { count: pending }) : undefined}
    >
      {pending === 0 ? (
        <div className="flex min-h-[56px] items-center gap-3 border-t border-n-divider px-4 py-2.5">
          <CircleCheck
            className="h-[18px] w-[18px] flex-none text-success"
            strokeWidth={1.5}
            aria-hidden
          />
          <span className="min-w-0">
            <span className="block text-[15px] font-medium text-foreground">
              {t('workQueueEmpty')}
            </span>
            <span className="block text-[13px] text-faint">
              {t('workQueueEmptyHint')}
            </span>
          </span>
        </div>
      ) : (
        WORKLIST_ORDER.map((key) => (
          <WorkRow key={key} work={key} count={counts[key]} />
        ))
      )}
    </PanelSection>
  );
}

function WorkRow({ work, count }: { work: TrackWorklist; count: number }) {
  const locale = useLocale() as Lang;
  const { label, hint } = worklistLabel(work, locale);
  const Icon = WORKLIST_ICONS[work];

  return (
    <Link
      href={`/tracks?work=${work}`}
      className={cn(
        'flex min-h-[56px] items-center gap-3 border-t border-n-divider px-4 py-2.5 transition-colors md:min-h-[48px]',
        'hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
      )}
    >
      <Icon
        className="h-[18px] w-[18px] flex-none text-faint"
        strokeWidth={1.5}
        aria-hidden
      />

      {/* Two lines on a phone, one on desktop where there is room for both. */}
      <span className="min-w-0 flex-1 md:flex md:items-baseline md:gap-3">
        <span className="block truncate text-[15px] font-medium text-foreground">
          {label}
        </span>
        <span className="block truncate text-[13px] text-faint">{hint}</span>
      </span>

      <span
        className={cn(
          'flex-none text-[18px] font-semibold leading-none',
          // Amber only for the queue that is a service failure in progress:
          // a parcel ready for a week is a customer who was not told.
          work === 'stale_pickup' ? 'text-warning' : 'text-foreground',
        )}
      >
        {count}
      </span>
      <ChevronRight
        className="h-4 w-4 flex-none text-faint"
        strokeWidth={1.5}
        aria-hidden
      />
    </Link>
  );
}

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { worklistLabel, type Lang, type TrackWorklist } from '@kargotrack/shared';

import { SectionCard } from '@/components/ui/section-card';
import { cn } from '@/lib/utils';
import type { WorklistCounts } from '@/lib/queries';
import { WORKLIST_ICONS, WORKLIST_ORDER } from '@/lib/worklist-ui';

/**
 * The operational queue that opens the dashboard (AUDIT.md T19). The six §5.10
 * cards report how the month went; at 9:00 the admin needs the opposite: what
 * has to be weighed, what nobody has claimed, what has been sitting on the
 * shelf for a week. Every row is a link into `/tracks?work=…` filtered by the
 * same condition the count was made with, so tapping a number lands on exactly
 * those rows.
 */
export function WorkQueue({ counts }: { counts: WorklistCounts }) {
  const t = useTranslations('dashboard');
  const pending = WORKLIST_ORDER.reduce((n, key) => n + counts[key], 0);

  return (
    <SectionCard
      title={t('workQueueTitle')}
      description={pending > 0 ? t('workQueuePending', { count: pending }) : undefined}
      className="animate-fade-in-up"
    >
      {pending === 0 ? (
        <div className="flex items-center gap-2.5 rounded-lg bg-[#e2f6e8] px-3 py-3">
          <span
            className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#c2e8cf] text-[13px] font-bold text-[#177338]"
            aria-hidden
          >
            ✓
          </span>
          <p className="text-[13px] font-medium text-[#177338]">
            {t('workQueueEmpty')}
          </p>
        </div>
      ) : (
        // One tall row per queue on phones (thumb-sized targets), three columns
        // from `sm` up so the block never grows taller than the fold on desktop.
        <div className="grid gap-2 sm:grid-cols-3">
          {WORKLIST_ORDER.map((key) => (
            <WorkTile key={key} work={key} count={counts[key]} />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function WorkTile({ work, count }: { work: TrackWorklist; count: number }) {
  const locale = useLocale() as Lang;
  const { label, hint } = worklistLabel(work, locale);
  const waiting = count > 0;

  return (
    <Link
      href={`/tracks?work=${work}`}
      className={cn(
        'flex min-h-[58px] items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        waiting
          ? 'border-[#f0e0c2] bg-[#fffbf3] hover:bg-[#fff6e6]'
          : 'border-border bg-white hover:bg-secondary',
      )}
    >
      <span
        className={cn(
          'flex h-9 w-9 flex-none items-center justify-center rounded-full text-base leading-none',
          waiting ? 'bg-[#fdf0d8]' : 'bg-secondary',
        )}
        aria-hidden
      >
        {WORKLIST_ICONS[work]}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-foreground">
          {label}
        </span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {hint}
        </span>
      </span>

      <span
        className={cn(
          'flex-none font-mono text-xl font-bold leading-none tabular-nums',
          waiting ? 'text-[#a35a00]' : 'text-slate-300',
        )}
      >
        {count}
      </span>
      <ChevronRight
        className="h-4 w-4 flex-none text-slate-300"
        strokeWidth={2}
        aria-hidden
      />
    </Link>
  );
}

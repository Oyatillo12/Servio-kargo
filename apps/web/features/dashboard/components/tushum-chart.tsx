import { useTranslations } from 'next-intl';

import { formatSom } from '@kargotrack/shared';
import type { TushumPoint } from '@kargotrack/shared';

import { cn } from '@/lib/utils';

/** `YYYY-MM-DD` → `DD.MM` (the key is already a Tashkent calendar day). */
function shortDate(dateKey: string): string {
  const [, m, d] = dateKey.split('-');
  return `${d}.${m}`;
}

/**
 * Daily-revenue bar chart for the last 14 days (SPEC §5.10). Pure CSS bars, no
 * charting dependency. Bars are `min-w-0 flex-1` so the row can never exceed the
 * viewport width (only the two end-date labels sit below — per-bar labels used
 * to overflow narrow phones). Hover/long-press shows the day + som via `title`.
 */
export function TushumChart({ points }: { points: TushumPoint[] }) {
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');

  const max = Math.max(1, ...points.map((p) => p.totalTiyin));
  const hasData = points.some((p) => p.totalTiyin > 0);
  const first = points[0];

  return (
    <div
      className="animate-fade-in-up rounded-xl border border-border bg-white p-4"
      style={{ animationDelay: '200ms' }}
    >
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">
          {t('dailyRevenue')}
        </h2>
        <span className="truncate text-[11px] text-muted-foreground">
          {hasData ? t('chartMax', { amount: formatSom(max) }) : t('chartRange')}
        </span>
      </div>

      {hasData ? (
        <>
          <div className="flex h-36 items-end gap-1">
            {points.map((p) => {
              // Give non-zero days a visible minimum so tiny values still read.
              const pct =
                p.totalTiyin > 0 ? Math.max(5, (p.totalTiyin / max) * 100) : 2;
              return (
                <div
                  key={p.dateKey}
                  className="group flex h-full min-w-0 flex-1 items-end"
                  title={`${shortDate(p.dateKey)} — ${formatSom(p.totalTiyin)} ${tCommon('som')}`}
                >
                  <div
                    className={cn(
                      'w-full rounded-t transition-colors',
                      p.totalTiyin > 0
                        ? 'bg-primary/75 group-hover:bg-primary'
                        : 'bg-secondary',
                    )}
                    style={{ height: `${pct}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
            <span>{first ? shortDate(first.dateKey) : ''}</span>
            <span>{t('periodToday')}</span>
          </div>
        </>
      ) : (
        <div className="flex h-36 items-center justify-center text-[13px] text-muted-foreground">
          {t('chartEmpty')}
        </div>
      )}
    </div>
  );
}

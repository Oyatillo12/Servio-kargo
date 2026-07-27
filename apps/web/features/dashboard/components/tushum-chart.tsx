import { useTranslations } from 'next-intl';

import { formatSom } from '@kargotrack/shared';
import type { TushumPoint } from '@kargotrack/shared';

import { PanelSection } from '@/components/ui/panel-section';
import { cn } from '@/lib/utils';

/** `YYYY-MM-DD` → `DD.MM` (the key is already a Tashkent calendar day). */
function shortDate(dateKey: string): string {
  const [, m, d] = dateKey.split('-');
  return `${d}.${m}`;
}

/**
 * Daily-revenue bars for the last 14 days (SPEC §5.10, design 1a/1b). Pure CSS,
 * no charting dependency — 14 rectangles do not justify one.
 *
 * With no payments recorded the bars collapse to a 2px baseline and the empty
 * state says what to do rather than that there is nothing: a new tenant's chart
 * is empty because nobody has entered a payment yet, not because business is
 * bad. Hover/long-press gives the day and amount via `title`.
 */
export function TushumChart({ points }: { points: TushumPoint[] }) {
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');

  const max = Math.max(1, ...points.map((p) => p.totalTiyin));
  const hasData = points.some((p) => p.totalTiyin > 0);
  const first = points[0];

  return (
    <PanelSection
      className="md:col-span-4"
      title={t('dailyRevenue')}
      meta={hasData ? t('chartMax', { amount: formatSom(max) }) : t('chartRange')}
    >
      <div className="relative mt-1 h-[88px] md:h-[100px]">
        <div className="absolute inset-0 flex items-end gap-[3px] border-b border-n-200 md:gap-1">
          {points.map((p) => {
            // Give non-zero days a visible minimum so tiny values still read;
            // zero days keep a 2px stub so the 14-day window stays legible.
            const pct =
              p.totalTiyin > 0 ? Math.max(5, (p.totalTiyin / max) * 100) : 0;
            return (
              <div
                key={p.dateKey}
                className="group flex h-full min-w-0 flex-1 items-end"
                title={`${shortDate(p.dateKey)} — ${formatSom(p.totalTiyin)} ${tCommon('som')}`}
              >
                <div
                  className={cn(
                    'w-full rounded-t-[2px] transition-colors',
                    p.totalTiyin > 0
                      ? 'bg-primary/80 group-hover:bg-primary'
                      : 'h-[2px] rounded-[1px] bg-[#e9ebef]',
                  )}
                  style={pct > 0 ? { height: `${pct}%` } : undefined}
                />
              </div>
            );
          })}
        </div>

        {hasData ? null : (
          <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-[13px] text-faint">
            {t('chartEmpty')}
          </p>
        )}
      </div>

      {hasData ? (
        <div className="mt-2 flex justify-between text-[11px] text-faint">
          <span>{first ? shortDate(first.dateKey) : ''}</span>
          <span>{t('periodToday')}</span>
        </div>
      ) : null}
    </PanelSection>
  );
}

import { getTranslations } from 'next-intl/server';

import { formatSom } from '@kargotrack/shared';

import { PanelSection } from '@/components/ui/panel-section';
import type { CashByStaffRow } from '@/lib/queries';

/**
 * Who collected the cash (SPEC §5.10, AUDIT.md T8).
 *
 * The closing-the-day view a cash business actually needs, and the reason
 * `payments.created_by` exists: one total tells an owner how much came in, this
 * tells them from whose counter. Owner-only.
 *
 * Rendered as a share bar per person rather than a table — the question is "is
 * this split what I expect", which a length answers faster than four numbers.
 * Hidden entirely when nothing was collected: an empty state here would be a
 * daily reminder of a thing that is simply not true yet at 09:00.
 */
export async function CashByStaff({
  rows,
  periodLabel,
}: {
  rows: CashByStaffRow[];
  periodLabel: string;
}) {
  const t = await getTranslations('dashboard');
  const tCommon = await getTranslations('common');

  if (rows.length === 0) return null;

  const total = rows.reduce((sum, r) => sum + r.totalTiyin, 0);
  if (total <= 0) return null;

  return (
    <PanelSection
      className="md:col-span-4"
      title={t('cashByStaff')}
      meta={periodLabel}
    >
      <p className="mb-3 font-mono text-title font-semibold tabular-nums text-foreground">
        {formatSom(total)}{' '}
        <span className="text-small font-normal text-muted-foreground">
          {tCommon('som')}
        </span>
      </p>

      <ul className="flex flex-col gap-2.5">
        {rows.map((r) => {
          const share = Math.round((r.totalTiyin / total) * 100);
          return (
            <li key={r.adminUserId ?? 'unattributed'}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-small font-medium text-foreground">
                  {/* Rows written before the column existed have nobody to
                      name; saying so beats an blank line that reads as a bug. */}
                  {r.name ?? t('cashUnattributed')}
                </span>
                <span className="flex-none font-mono text-small font-semibold tabular-nums text-foreground">
                  {formatSom(r.totalTiyin)}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary"
                >
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${Math.max(share, 2)}%` }}
                  />
                </span>
                <span className="flex-none text-micro tabular-nums text-faint">
                  {t('cashPaymentCount', { count: r.count })}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </PanelSection>
  );
}

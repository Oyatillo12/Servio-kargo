import Link from 'next/link';
import { ArrowRight, CircleCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { formatSom } from '@kargotrack/shared';

import { PanelSection } from '@/components/ui/panel-section';
import { cn } from '@/lib/utils';

/**
 * The two money figures, in the weight the design gives them (screens 1a–1c):
 * revenue for the selected period as a quiet header line, debt as the 28px
 * figure below it.
 *
 * They are not two equal cards. Revenue is a number the owner notes; debt is
 * money already earned and not collected, and it is the only thing on this
 * screen that can be acted on — so it is the one that is large, red and a link
 * into `/debtors`. With nothing outstanding it drops to plain dark text and a
 * green "no debtors": the colour has to mean something, or it means nothing.
 */
export function MoneyBlock({
  revenueTiyin,
  periodLabel,
  debtTiyin,
  debtorCount,
}: {
  revenueTiyin: number;
  periodLabel: string;
  debtTiyin: number;
  debtorCount: number;
}) {
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  const hasDebt = debtTiyin > 0;

  const debtBody = (
    <>
      <p className="eyebrow">{t('debt')}</p>
      <p
        className={cn(
          // `formatSom` groups with a plain space, which is a legal break
          // point — a 9-digit total must never split across two lines.
          'mt-1 whitespace-nowrap font-mono font-semibold leading-[1.1] tabular-nums',
          hasDebt
            ? 'text-display font-bold text-destructive'
            : 'text-display font-bold text-foreground',
        )}
      >
        {formatSom(debtTiyin)}{' '}
        <span
          className={cn(
            'text-body font-medium',
            hasDebt ? 'text-destructive/70' : 'text-faint',
          )}
        >
          {tCommon('som')}
        </span>
      </p>
      {hasDebt ? (
        <p className="mt-2 flex items-center gap-1 text-small font-semibold text-destructive">
          {t('debtorCount', { count: debtorCount })}
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        </p>
      ) : (
        <p className="mt-1.5 flex items-center gap-1.5 text-small font-medium text-success">
          <CircleCheck className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
          {t('debtorsNone')}
        </p>
      )}
    </>
  );

  return (
    <PanelSection flush className="md:col-span-2">
      <div className="flex items-baseline justify-between gap-3 border-b border-n-divider px-4 py-3">
        <span className="text-small text-muted-foreground">
          {t('revenue', { period: periodLabel })}
        </span>
        <span
          className={cn(
            'flex-none font-mono text-lead font-semibold tabular-nums',
            revenueTiyin > 0 ? 'text-foreground' : 'text-faint',
          )}
        >
          {formatSom(revenueTiyin)}{' '}
          <span className="text-micro font-medium">{tCommon('som')}</span>
        </span>
      </div>

      {hasDebt ? (
        <Link
          href="/debtors"
          className="block px-4 pb-4 pt-3.5 transition-colors hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          {debtBody}
        </Link>
      ) : (
        <div className="px-4 pb-4 pt-3.5">{debtBody}</div>
      )}
    </PanelSection>
  );
}

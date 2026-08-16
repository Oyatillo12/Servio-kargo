import { useTranslations } from 'next-intl';

import { formatSom } from '@kargotrack/shared';

/**
 * Debt display (SPEC §7.5): positive = red `{n} so'm`, negative = green
 * `Avans: {n} so'm`, zero = muted dash. Never shows a leading minus sign.
 *
 * `formatSom` groups thousands with plain spaces, which a narrow phone column
 * will happily break mid-number ("45 000" / "000") — hence `whitespace-nowrap`.
 */
export function DebtCell({ tiyin }: { tiyin: number }) {
  const t = useTranslations('debtors');
  const tCommon = useTranslations('common');

  if (tiyin > 0) {
    return (
      <span className="whitespace-nowrap font-mono font-semibold tabular-nums text-destructive">
        {formatSom(tiyin)} {tCommon('som')}
      </span>
    );
  }
  if (tiyin < 0) {
    return (
      <span className="whitespace-nowrap font-mono font-medium tabular-nums text-success">
        {t('advance', { amount: formatSom(Math.abs(tiyin)) })}
      </span>
    );
  }
  return <span className="text-faint">{t('noDebt')}</span>;
}

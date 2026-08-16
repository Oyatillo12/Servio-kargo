import { getTranslations } from 'next-intl/server';
import { AlertTriangle } from 'lucide-react';

import { billingNeedsBanner, billingState } from '@kargotrack/shared';

/**
 * The subscription warning (SPEC §5.17, §7.19 — D-011). This bar IS the
 * warning channel: nothing is sent to the bot or anywhere else, which is what
 * lets it stay stateless — a banner is computed on every render, so it can
 * neither be missed twice nor sent twice.
 *
 * Shown to every role. An owner who is away should not be the only person in
 * the company who could have seen it.
 */
export async function BillingBanner({
  paidUntil,
}: {
  paidUntil: string | null;
}) {
  const status = billingState(paidUntil, new Date());
  if (!billingNeedsBanner(status)) return null;

  const t = await getTranslations('billing');
  const date = status.paidUntil ?? '';
  const grace = status.state === 'grace';
  const days = (grace ? status.graceDaysLeft : status.daysLeft) ?? 0;
  const text = grace
    ? days === 0
      ? t('bannerGraceToday', { date })
      : t('bannerGrace', { date, days })
    : days === 0
      ? t('bannerDueToday', { date })
      : t('bannerDue', { date, days });

  return (
    <div
      role="status"
      className={`flex items-center justify-center gap-2 px-4 py-2 text-center text-[13px] font-medium ${
        grace
          ? 'bg-red-50 text-red-800'
          : 'bg-amber-50 text-amber-900'
      }`}
    >
      <AlertTriangle className="h-4 w-4 flex-none" aria-hidden />
      <span>{text}</span>
    </div>
  );
}

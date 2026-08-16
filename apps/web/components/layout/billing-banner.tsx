import { getTranslations } from 'next-intl/server';
import { AlertTriangle } from 'lucide-react';

import { billingNeedsBanner, billingState, type AdminRole } from '@kargotrack/shared';

/**
 * The subscription warning (SPEC §5.17, §7.19 — D-011). This bar IS the
 * warning channel: nothing is sent to the bot or anywhere else, which is what
 * lets it stay stateless — a banner is computed on every render, so it can
 * neither be missed twice nor sent twice.
 *
 * Owner only, like the lock screen's billing detail: the owner rejected
 * warning the whole team precisely because a company's invoice is not the
 * warehouse hand's business (D-011, rejected option).
 */
export async function BillingBanner({
  paidUntil,
  role,
}: {
  paidUntil: string | null;
  role: AdminRole;
}) {
  if (role !== 'owner') return null;

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
      className={`flex items-center justify-center gap-2 border-b px-4 py-2 text-center text-small font-medium ${
        grace
          ? 'border-destructive/30 bg-[var(--st-lost-bg)] text-destructive'
          : 'border-warning/30 bg-[var(--st-china-bg)] text-warning'
      }`}
    >
      <AlertTriangle className="h-4 w-4 flex-none" aria-hidden />
      <span>{text}</span>
    </div>
  );
}

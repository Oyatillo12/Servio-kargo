import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { PauseCircle } from 'lucide-react';

import { requireAdmin } from '@/lib/auth';
import { homeRouteFor } from '@/lib/home-route';
import { RouteDots, Wordmark } from '@/components/layout/brand';
import { logoutAction } from '@/features/auth/actions';
import { CONTACT_PHONE, TELEGRAM_URL } from '@/features/marketing/config';

export async function generateMetadata() {
  const t = await getTranslations('billing');
  return { title: `${t('lockedTitle')} — SERVIO Kargo` };
}

/**
 * Where every panel page lands while `tenants.active` is false (SPEC §5.17,
 * §7.19 — D-011). The session stays valid and login keeps working on purpose:
 * the first question a closed owner asks is whether the data is gone, and the
 * screen that answers it is the one that gets the invoice paid.
 *
 * Billing detail is shown to the owner only — whose invoice it is is not the
 * warehouse hand's business.
 */
export default async function LockedPage() {
  const { tenant, role } = await requireAdmin({ allowInactive: true });
  // Paid up again → straight back to work; a stale lock screen would read as
  // "still closed" to someone who just got it reopened.
  if (tenant.active) redirect(homeRouteFor(role));

  const t = await getTranslations('billing');
  const tNav = await getTranslations('nav');
  const isOwner = role === 'owner';

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-7 px-5 py-10">
      <div className="flex flex-col items-center gap-2.5 text-center">
        <Wordmark className="h-9" />
        <RouteDots />
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-5 shadow-sm">
        <div className="flex flex-col items-center gap-2 text-center">
          <PauseCircle className="h-8 w-8 text-amber-600" aria-hidden />
          <p className="text-[13px] font-medium text-muted-foreground">
            {tenant.name}
          </p>
          <h1 className="text-lg font-bold">{t('lockedTitle')}</h1>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            {isOwner ? t('lockedOwner') : t('lockedStaff')}
          </p>
        </div>

        {isOwner && tenant.paidUntil ? (
          <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-center text-[13px] tabular-nums">
            {t('lockedPaidUntil', { date: tenant.paidUntil })}
          </p>
        ) : null}

        {isOwner ? (
          <div className="mt-4 space-y-1.5 text-center text-[13px]">
            <p className="font-medium">{t('lockedContact')}</p>
            {CONTACT_PHONE ? (
              <a
                href={`tel:${CONTACT_PHONE.replace(/[^+\d]/g, '')}`}
                className="block tabular-nums underline"
              >
                {CONTACT_PHONE}
              </a>
            ) : null}
            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noreferrer"
              className="block underline"
            >
              Telegram
            </a>
          </div>
        ) : null}

        {/* The only working control on the page. */}
        <form action={logoutAction} className="mt-5">
          <button
            type="submit"
            className="w-full rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            {tNav('logout')}
          </button>
        </form>
      </div>
    </main>
  );
}

import Link from 'next/link';
import { ArrowLeft, Scale } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { can } from '@kargotrack/shared';

import { requireCapability } from '@/lib/auth';
import { getDefaultTariff, listTodaysWeighings } from '@/lib/queries';
import { WeighConsole } from '@/features/weigh/components/weigh-console';

export async function generateMetadata() {
  const t = await getTranslations('weigh');
  return { title: `${t('pageTitle')} — SERVIO Kargo` };
}

/**
 * The warehouse weighing screen (tasks.md W1).
 *
 * Deliberately OUTSIDE the `(app)` route group: no sidebar, no tab bar, no
 * dashboard chrome. This is one job done a few hundred times a shift on a phone
 * held over a scale, and every pixel that is not the code field, the weight
 * field or today's list is in the way. The only way out is the one link in the
 * header — which is enough, because the people who live on this screen have no
 * reason to leave it.
 *
 * It is a plain web page for a reason: Telegram is blocked in China, so the
 * bot's staff mode needs a VPN in exactly the warehouse where the weighing
 * happens. This does not.
 */
export default async function WeighPage() {
  const { tenant, admin, role } = await requireCapability('tracks.weigh');
  const t = await getTranslations('weigh');

  const [tariff, rows] = await Promise.all([
    getDefaultTariff(tenant.id),
    listTodaysWeighings(tenant.id, admin.id),
  ]);

  // §7.4: without a default tariff — or a kurs, for a USD tenant — nothing can
  // be priced. Say so up front instead of letting every entry fail one by one.
  const blockedReason = !tariff
    ? t('noTariff')
    : tenant.currency === 'USD' && tenant.usdRateTiyin == null
      ? t('noUsdRate')
      : null;

  return (
    <main className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-10 flex h-[52px] items-center gap-2 border-b border-n-200 bg-white px-3">
        <Scale className="h-5 w-5 flex-none text-primary" strokeWidth={1.5} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold leading-tight text-foreground">
            {t('pageTitle')}
          </p>
          <p className="truncate text-[11.5px] leading-tight text-muted-foreground">
            {tenant.name}
          </p>
        </div>
        <Link
          href="/tracks"
          className="flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t('exit')}
        </Link>
      </header>

      <div className="mx-auto w-full max-w-lg flex-1 px-3 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <WeighConsole
          initialRows={rows}
          canAssign={can(role, 'tracks.assign')}
          blockedReason={blockedReason}
        />
      </div>
    </main>
  );
}

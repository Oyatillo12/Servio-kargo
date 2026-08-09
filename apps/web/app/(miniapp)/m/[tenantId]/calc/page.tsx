import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getTwaContext } from '@/lib/twa/auth';
import { listTwaTariffs } from '@/lib/twa/queries';

import { CalcClient } from './calc-client';

export default async function TwaCalcPage({
  params,
}: {
  params: { tenantId: string };
}) {
  const gate = await getTwaContext(params.tenantId);
  if (gate.state === 'not_found') notFound();
  if (gate.state !== 'ok') redirect(`/m/${params.tenantId}`);
  const { tenant, customer } = gate;

  const t = await getTranslations({ locale: customer.lang, namespace: 'twa' });
  const tariffs = await listTwaTariffs(tenant.id);

  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">{t('navCalc')}</h1>
        <Link
          href={`/m/${tenant.id}`}
          className="text-sm text-muted-foreground"
        >
          {t('backHome')}
        </Link>
      </header>

      <CalcClient
        tariffs={tariffs}
        currency={tenant.currency}
        usdRateTiyin={tenant.usdRateTiyin}
      />
    </div>
  );
}

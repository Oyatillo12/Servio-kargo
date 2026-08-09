import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { AddTracksForm } from '@/features/twa/components/add-form';
import { Screen } from '@/features/twa/components/screen';
import { getTwaContext } from '@/lib/twa/auth';

export default async function TwaAddPage({
  params,
}: {
  params: { tenantId: string };
}) {
  const gate = await getTwaContext(params.tenantId);
  if (gate.state === 'not_found') notFound();
  if (gate.state !== 'ok') redirect(`/m/${params.tenantId}`);
  const { tenant, customer } = gate;

  const t = await getTranslations({ locale: customer.lang, namespace: 'twa' });

  return (
    <Screen
      title={t('navAdd')}
      backHref={`/m/${tenant.id}`}
      backLabel={t('backHome')}
    >
      <p className="twa-hint twa-rise text-[13px] leading-relaxed">
        {t('addHint')}
      </p>
      <AddTracksForm tenantId={tenant.id} />
    </Screen>
  );
}

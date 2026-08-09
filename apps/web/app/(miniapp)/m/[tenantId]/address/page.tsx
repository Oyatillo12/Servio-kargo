import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getTwaContext } from '@/lib/twa/auth';

import { CopyButton } from './copy-button';

export default async function TwaAddressPage({
  params,
}: {
  params: { tenantId: string };
}) {
  const gate = await getTwaContext(params.tenantId);
  if (gate.state === 'not_found') notFound();
  if (gate.state !== 'ok') redirect(`/m/${params.tenantId}`);
  const { tenant, customer } = gate;

  const t = await getTranslations({ locale: customer.lang, namespace: 'twa' });

  // Same substitution the bot's /manzil does (SPEC §3.7): the client code IS
  // the routing key the China warehouse sorts by.
  const address = tenant.chinaAddressTemplate
    ? tenant.chinaAddressTemplate.replaceAll('{client_code}', customer.clientCode)
    : null;

  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">{t('navAddress')}</h1>
        <Link
          href={`/m/${tenant.id}`}
          className="text-sm text-muted-foreground"
        >
          {t('backHome')}
        </Link>
      </header>

      {address ? (
        <>
          <p className="text-[12.5px] text-muted-foreground">
            {t('addressHint')}
          </p>
          <pre className="whitespace-pre-wrap break-words rounded-xl border border-[#eef0f4] bg-white px-4 py-3.5 font-mono text-[13px] leading-relaxed text-foreground">
            {address}
          </pre>
          <CopyButton text={address} />
        </>
      ) : (
        <p className="rounded-xl border border-dashed border-[#dfe3ea] px-4 py-10 text-center text-sm text-muted-foreground">
          {t('addressMissing')}
        </p>
      )}
    </div>
  );
}

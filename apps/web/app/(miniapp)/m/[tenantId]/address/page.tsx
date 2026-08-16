import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { CopyChip } from '@/features/twa/components/copy-chip';
import { Screen } from '@/features/twa/components/screen';
import { getTwaContext } from '@/lib/twa/auth';

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
    ? tenant.chinaAddressTemplate.replaceAll(
        '{client_code}',
        customer.clientCode,
      )
    : null;

  return (
    <Screen
      title={t('navAddress')}
      backHref={`/m/${tenant.id}`}
      backLabel={t('backHome')}
    >
      {address ? (
        <>
          <p className="twa-hint twa-rise text-small leading-relaxed">
            {t('addressHint')}
          </p>
          <pre
            className="twa-card twa-rise whitespace-pre-wrap break-words px-4 py-4 font-mono text-small leading-relaxed"
            style={{ '--twa-i': 1 } as React.CSSProperties}
          >
            {address}
          </pre>
          <div
            className="twa-rise"
            style={{ '--twa-i': 2 } as React.CSSProperties}
          >
            <CopyChip
              text={address}
              label={t('addressCopy')}
              copiedLabel={t('addressCopied')}
              block
            />
          </div>
        </>
      ) : (
        <p
          className="twa-hint twa-rise rounded-2xl border border-dashed px-4 py-10 text-center text-sm"
          style={{ borderColor: 'var(--twa-border)' }}
        >
          {t('addressMissing')}
        </p>
      )}
    </Screen>
  );
}

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { formatDate, formatKg, formatSom } from '@kargotrack/shared';

import { getTwaContext } from '@/lib/twa/auth';
import { listTwaTracks } from '@/lib/twa/queries';

import { StatusPill } from '../status-pill';

export default async function TwaTracksPage({
  params,
}: {
  params: { tenantId: string };
}) {
  const gate = await getTwaContext(params.tenantId);
  if (gate.state === 'not_found') notFound();
  if (gate.state !== 'ok') redirect(`/m/${params.tenantId}`);
  const { tenant, customer } = gate;

  const t = await getTranslations({ locale: customer.lang, namespace: 'twa' });
  const tCommon = await getTranslations({
    locale: customer.lang,
    namespace: 'common',
  });
  const rows = await listTwaTracks(tenant.id, customer.id);

  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">{t('navTracks')}</h1>
        <Link
          href={`/m/${tenant.id}`}
          className="text-sm text-muted-foreground"
        >
          {t('backHome')}
        </Link>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#dfe3ea] px-4 py-10 text-center text-sm text-muted-foreground">
          {t('noTracks')}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((tr) => (
            <li key={tr.id}>
              <Link
                href={`/m/${tenant.id}/tracks/${tr.id}`}
                className="block rounded-xl border border-[#eef0f4] bg-white px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-mono text-[13px] font-semibold text-foreground">
                    {tr.codeOriginal}
                  </span>
                  <StatusPill
                    status={tr.currentStatus}
                    lang={customer.lang}
                    className="flex-none"
                  />
                </div>
                <p className="mt-1 flex items-center gap-3 font-mono text-[11.5px] text-muted-foreground">
                  <span>{formatDate(tr.createdAt)}</span>
                  {tr.weightGrams != null ? (
                    <span>{formatKg(tr.weightGrams)} kg</span>
                  ) : null}
                  {tr.priceTiyin != null ? (
                    <span>
                      {formatSom(tr.priceTiyin)} {tCommon('som')}
                    </span>
                  ) : null}
                  {tr.batchEta ? (
                    <span>
                      {t('etaShort')} {tr.batchEta}
                    </span>
                  ) : null}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

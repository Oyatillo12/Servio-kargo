import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ImageIcon, PlusCircle } from 'lucide-react';

import {
  formatDate,
  formatKg,
  formatSom,
  storedChargeableWeight,
} from '@kargotrack/shared';

import { Pipeline } from '@/features/twa/components/pipeline';
import { Screen } from '@/features/twa/components/screen';
import { StatusPill } from '@/features/twa/components/status-pill';
import { getTwaContext } from '@/lib/twa/auth';
import { listTwaTracks, type TwaTrackRow } from '@/lib/twa/queries';

/**
 * §7.16: what this row's price was built on, read from the frozen columns.
 * Kept beside the list because the kg and the so'm share one line — showing the
 * scale reading next to a volumetric price is the arithmetic that starts a
 * dispute.
 */
function chargedOf(row: TwaTrackRow) {
  return storedChargeableWeight(row.weightGrams, row.volumetricGrams);
}

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
    <Screen
      title={t('navTracks')}
      backHref={`/m/${tenant.id}`}
      backLabel={t('backHome')}
      action={
        <Link
          href={`/m/${tenant.id}/add`}
          aria-label={t('navAdd')}
          className="twa-press flex h-9 w-9 items-center justify-center rounded-xl"
          style={{
            background: 'var(--twa-brand-soft)',
            color: 'var(--twa-brand-ink)',
          }}
        >
          <PlusCircle className="h-5 w-5" aria-hidden />
        </Link>
      }
    >
      {rows.length === 0 ? (
        <div
          className="twa-rise flex flex-col items-center gap-3 rounded-2xl border border-dashed px-4 py-12 text-center"
          style={{ borderColor: 'var(--twa-border)' }}
        >
          <p className="twa-hint text-sm leading-relaxed">{t('noTracks')}</p>
          <Link
            href={`/m/${tenant.id}/add`}
            className="twa-btn twa-press w-auto px-5"
          >
            <PlusCircle className="h-4 w-4" aria-hidden />
            {t('navAdd')}
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((tr, i) => {
            const charged = chargedOf(tr);
            return (
            <li
              key={tr.id}
              className="twa-rise"
              style={{ '--twa-i': Math.min(i, 10) } as React.CSSProperties}
            >
              <Link
                href={`/m/${tenant.id}/tracks/${tr.id}`}
                className="twa-card twa-press block px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate font-mono text-[13px] font-semibold">
                      {tr.codeOriginal}
                    </span>
                    {tr.hasPhoto ? (
                      <ImageIcon
                        className="twa-hint h-3.5 w-3.5 flex-none"
                        aria-hidden
                      />
                    ) : null}
                  </span>
                  <StatusPill
                    status={tr.currentStatus}
                    lang={customer.lang}
                    className="flex-none"
                  />
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="w-16 flex-none">
                    <Pipeline status={tr.currentStatus} mini />
                  </div>
                  <p className="twa-hint min-w-0 flex-1 truncate font-mono text-[11.5px]">
                    {formatDate(tr.createdAt)}
                    {/* §7.16: the kg here sits next to the price, so it has to
                        be the kg that price was built on — and say so. */}
                    {charged != null
                      ? ` · ${formatKg(charged.grams)} kg${
                          charged.basis === 'volumetric'
                            ? ` ${t('listVolumetric')}`
                            : ''
                        }`
                      : ''}
                    {tr.priceTiyin != null
                      ? ` · ${formatSom(tr.priceTiyin)} ${tCommon('som')}`
                      : ''}
                    {tr.batchEta ? ` · ${t('etaShort')} ${tr.batchEta}` : ''}
                  </p>
                </div>
              </Link>
            </li>
            );
          })}
        </ul>
      )}
    </Screen>
  );
}

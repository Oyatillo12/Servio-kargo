import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import {
  formatDateTime,
  formatKg,
  formatSom,
  STATUS_META,
} from '@kargotrack/shared';

import { getTwaContext } from '@/lib/twa/auth';
import { getTwaTrackDetail } from '@/lib/twa/queries';

import { StatusPill } from '../../status-pill';

export default async function TwaTrackDetailPage({
  params,
}: {
  params: { tenantId: string; trackId: string };
}) {
  const gate = await getTwaContext(params.tenantId);
  if (gate.state === 'not_found') notFound();
  if (gate.state !== 'ok') redirect(`/m/${params.tenantId}`);
  const { tenant, customer } = gate;

  const detail = await getTwaTrackDetail(
    tenant.id,
    customer.id,
    params.trackId,
  );
  if (!detail) notFound();

  const t = await getTranslations({ locale: customer.lang, namespace: 'twa' });
  const tCommon = await getTranslations({
    locale: customer.lang,
    namespace: 'common',
  });

  return (
    <div className="space-y-3">
      <Link
        href={`/m/${tenant.id}/tracks`}
        className="text-sm text-muted-foreground"
      >
        ← {t('navTracks')}
      </Link>

      <div className="rounded-xl border border-[#eef0f4] bg-white px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <span className="break-all font-mono text-[14px] font-bold text-foreground">
            {detail.codeOriginal}
          </span>
          <StatusPill
            status={detail.currentStatus}
            lang={customer.lang}
            className="flex-none"
          />
        </div>
        <dl className="mt-2.5 space-y-1.5 border-t border-[#eef0f4] pt-2.5 text-[13px]">
          {detail.weightGrams != null ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t('trackWeight')}</dt>
              <dd className="font-mono font-semibold">
                {formatKg(detail.weightGrams)} kg
              </dd>
            </div>
          ) : null}
          {detail.priceTiyin != null ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t('trackPrice')}</dt>
              <dd className="font-mono font-semibold">
                {formatSom(detail.priceTiyin)} {tCommon('som')}
              </dd>
            </div>
          ) : null}
          {detail.batchEta ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t('etaLabel')}</dt>
              <dd className="font-mono font-semibold">{detail.batchEta}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      {detail.hasPhoto ? (
        <div className="overflow-hidden rounded-xl border border-[#eef0f4] bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element -- dynamic
              session-guarded API route; next/image adds nothing here */}
          <img
            src={`/api/twa/photo/${detail.id}`}
            alt={t('photoAlt')}
            className="w-full"
          />
        </div>
      ) : null}

      <div className="rounded-xl border border-[#eef0f4] bg-white px-4 py-3.5">
        <p className="text-[13px] font-semibold text-foreground">
          {t('statusHistory')}
        </p>
        <ul className="mt-2 space-y-2">
          {detail.events.length === 0 ? (
            <li className="text-sm text-muted-foreground">—</li>
          ) : (
            detail.events.map((e, i) => (
              <li
                key={`${e.status}-${i}`}
                className="flex items-center justify-between gap-3 text-[12.5px]"
              >
                <span className="text-foreground">
                  {STATUS_META[e.status][customer.lang]}
                </span>
                <span className="flex-none font-mono text-muted-foreground">
                  {formatDateTime(e.createdAt)}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

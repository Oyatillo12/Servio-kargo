import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import {
  formatDateTime,
  formatKg,
  formatSom,
  STATUS_META,
  isTerminalStatus,
} from '@kargotrack/shared';

import { CopyChip } from '@/features/twa/components/copy-chip';
import { Pipeline } from '@/features/twa/components/pipeline';
import { Screen } from '@/features/twa/components/screen';
import { StatusPill } from '@/features/twa/components/status-pill';
import { getTwaContext } from '@/lib/twa/auth';
import { getTwaTrackDetail } from '@/lib/twa/queries';

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
  const lost =
    isTerminalStatus(detail.currentStatus) &&
    detail.currentStatus !== 'DELIVERED';

  return (
    <Screen
      title={t('trackTitle')}
      backHref={`/m/${tenant.id}/tracks`}
      backLabel={t('navTracks')}
    >
      {/* The parcel card: code, where it is on the road, the facts */}
      <div className="twa-card twa-rise px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <span className="min-w-0 break-all font-mono text-[15px] font-bold leading-snug">
            {detail.codeOriginal}
          </span>
          <CopyChip
            text={detail.codeOriginal}
            label={t('copyCode')}
            copiedLabel={t('addressCopied')}
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <StatusPill status={detail.currentStatus} lang={customer.lang} />
          {detail.batchEta ? (
            <span
              className="font-mono text-[12px] font-semibold"
              style={{ color: 'var(--twa-copper)' }}
            >
              {t('etaShort')} {detail.batchEta}
            </span>
          ) : null}
        </div>

        {lost ? null : (
          <div className="mt-3">
            <Pipeline status={detail.currentStatus} />
          </div>
        )}

        {detail.weightGrams != null ||
        detail.priceTiyin != null ||
        detail.description != null ? (
          <dl
            className="twa-divider mt-3.5 border-t pt-1"
            style={{ borderColor: 'var(--twa-border)' }}
          >
            {detail.description != null ? (
              <div
                className="flex justify-between gap-3 py-2 text-[13.5px]"
                style={{ borderColor: 'var(--twa-border)' }}
              >
                <dt className="twa-hint flex-none">{t('trackDescription')}</dt>
                <dd className="min-w-0 break-words text-right font-semibold">
                  {detail.description}
                </dd>
              </div>
            ) : null}
            {detail.weightGrams != null ? (
              <div
                className="flex justify-between py-2 text-[13.5px]"
                style={{ borderColor: 'var(--twa-border)' }}
              >
                <dt className="twa-hint">{t('trackWeight')}</dt>
                <dd className="font-mono font-semibold tabular-nums">
                  {formatKg(detail.weightGrams)} kg
                </dd>
              </div>
            ) : null}
            {detail.priceTiyin != null ? (
              <div
                className="flex justify-between py-2 text-[13.5px]"
                style={{ borderColor: 'var(--twa-border)' }}
              >
                <dt className="twa-hint">{t('trackPrice')}</dt>
                <dd className="font-mono font-semibold tabular-nums">
                  {formatSom(detail.priceTiyin)} {tCommon('som')}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </div>

      {detail.photoIds.map((photoId, i) => (
        <div
          key={photoId}
          className="twa-card twa-rise overflow-hidden"
          style={{ '--twa-i': 1 + i } as React.CSSProperties}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- dynamic
              session-guarded API route; next/image adds nothing here */}
          <img
            src={`/api/twa/photo/${detail.id}/${photoId}`}
            alt={t('photoAlt')}
            className="w-full"
          />
        </div>
      ))}

      {/* Journey log */}
      <div
        className="twa-card twa-rise px-4 py-3.5"
        style={{ '--twa-i': 2 } as React.CSSProperties}
      >
        <p className="text-[13px] font-bold">{t('statusHistory')}</p>
        <ul className="twa-divider mt-1">
          {detail.events.length === 0 ? (
            <li className="twa-hint py-2 text-sm">—</li>
          ) : (
            detail.events.map((e, i) => {
              const last = i === detail.events.length - 1;
              return (
                <li
                  key={`${e.status}-${i}`}
                  className="flex items-center justify-between gap-3 py-2.5 text-[12.5px]"
                  style={{ borderColor: 'var(--twa-border)' }}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-1.5 w-1.5 flex-none rounded-full"
                      style={{
                        background: last
                          ? 'var(--twa-copper)'
                          : 'var(--twa-brand-ink)',
                      }}
                      aria-hidden
                    />
                    <span
                      className={`truncate ${last ? 'font-semibold' : ''}`}
                    >
                      {STATUS_META[e.status][customer.lang]}
                    </span>
                  </span>
                  <span className="twa-hint flex-none font-mono text-[11.5px]">
                    {formatDateTime(e.createdAt)}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </Screen>
  );
}

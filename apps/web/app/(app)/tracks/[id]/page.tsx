import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';

import {
  PIPELINE_ORDER,
  formatDateTime,
  formatKg,
  formatSom,
  formatUsd,
  isAssignEventMeta,
  type Lang,
  type TrackStatus,
} from '@kargotrack/shared';

import { StatusBadge } from '@/components/shared/status-badge';
import { SectionCard } from '@/components/ui/section-card';
import { requireAdmin } from '@/lib/auth';
import { getTrackDetail, listActiveTariffs } from '@/lib/queries';
import { statusView } from '@/lib/status-ui';
import { cn } from '@/lib/utils';
import { CustomerCard } from '@/features/tracks/components/customer-card';
import {
  WeightForm,
  type TariffOption,
} from '@/features/tracks/components/weight-form';
import { TrackActions } from '@/features/tracks/components/track-actions';

export async function generateMetadata() {
  const t = await getTranslations('trackDetail');
  return { title: `${t('pageTitle')} — SERVIO Kargo` };
}

/** The four stages the China→Uzbekistan progress rail shows (design screen 05). */
const RAIL: { key: TrackStatus; labelKey: string; emoji: string }[] = [
  { key: 'CHINA_WAREHOUSE', labelKey: 'railChina', emoji: '📦' },
  { key: 'IN_TRANSIT', labelKey: 'railTransit', emoji: '🚚' },
  { key: 'TASHKENT_WAREHOUSE', labelKey: 'railTashkent', emoji: '🇺🇿' },
  { key: 'DELIVERED', labelKey: 'railDelivered', emoji: '✅' },
];

/** Horizontal China→Uzbekistan progress rail (design screen 05). */
function RouteRail({
  status,
  labels,
}: {
  status: TrackStatus;
  labels: Record<string, string>;
}) {
  const order = PIPELINE_ORDER as readonly TrackStatus[];
  const currentIndex = order.indexOf(status); // -1 for LOST/RETURNED
  const reached = RAIL.map((s) => currentIndex >= order.indexOf(s.key));
  const activeIndex = reached.lastIndexOf(true);

  return (
    <div className="flex items-center">
      {RAIL.map((stage, i) => {
        const isActive = i === activeIndex;
        const isDone = reached[i] && !isActive;
        return (
          <div key={stage.key} className="contents">
            {i > 0 ? (
              <div
                className={cn(
                  'mb-[18px] flex-1 border-t-2',
                  reached[i]
                    ? 'border-solid border-primary'
                    : 'border-dotted border-[#c3c9d6]',
                )}
              />
            ) : null}
            <div className="flex w-[58px] flex-none flex-col items-center gap-1.5">
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] text-[15px]',
                  isActive &&
                    'border-primary bg-primary shadow-[0_0_0_4px_#e0e4f4]',
                  isDone && 'border-primary bg-accent',
                  !reached[i] &&
                    'border-[#c3c9d6] bg-white opacity-65 grayscale',
                )}
              >
                {stage.emoji}
              </div>
              <span
                className={cn(
                  'text-[10px]',
                  isActive
                    ? 'font-bold text-primary'
                    : reached[i]
                      ? 'font-semibold text-slate-600'
                      : 'font-medium text-muted-foreground',
                )}
              >
                {labels[stage.labelKey]}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default async function TrackDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { tenant } = await requireAdmin();
  const t = await getTranslations('trackDetail');
  const tCommon = await getTranslations('common');
  const tTracks = await getTranslations('tracks');
  const locale = (await getLocale()) as Lang;

  const [detail, activeTariffs] = await Promise.all([
    getTrackDetail(tenant.id, params.id),
    listActiveTariffs(tenant.id),
  ]);
  if (!detail) notFound();

  const { track, customer, batch, events } = detail;
  const isUsd = tenant.currency === 'USD';

  /** Labels for the ownership-change events the timeline mixes in (§5.3). */
  const assignLabels: Record<string, string> = {
    attach: t('assignAttach'),
    detach: t('assignDetach'),
    reassign: t('assignReassign'),
  };
  const railLabels: Record<string, string> = {
    railChina: t('railChina'),
    railTransit: t('railTransit'),
    railTashkent: t('railTashkent'),
    railDelivered: t('railDelivered'),
  };

  const defaultWeight =
    track.weightGrams != null ? formatKg(track.weightGrams) : '';
  const priceText =
    track.priceTiyin != null
      ? `${formatSom(track.priceTiyin)} ${tCommon('som')}`
      : tCommon('dash');
  const priceUsdText =
    isUsd && track.priceUsdCents != null
      ? formatUsd(track.priceUsdCents)
      : undefined;

  const tariffOptions: TariffOption[] = activeTariffs.map((tf) => ({
    id: tf.id,
    label: isUsd
      ? `${tf.name} · ${formatUsd(tf.pricePerKgMinor)}/${tCommon('kg')}`
      : `${tf.name} · ${formatSom(tf.pricePerKgMinor)} ${tCommon('som')}/${tCommon('kg')}`,
  }));
  const initialManualPriceSom =
    track.priceManual && track.priceTiyin != null
      ? String(Math.round(track.priceTiyin / 100))
      : '';

  return (
    <div className="mx-auto max-w-md space-y-3">
      <Link
        href="/tracks"
        className="inline-flex items-center gap-1.5 rounded text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {tTracks('pageTitle')}
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-mono text-xl font-semibold text-foreground">
          {track.codeOriginal}
        </h1>
        <StatusBadge status={track.currentStatus} />
      </div>

      {/* Route rail */}
      <SectionCard className="px-3.5 pb-3.5 pt-4">
        <RouteRail status={track.currentStatus} labels={railLabels} />
        <p className="mt-2.5 text-center text-xs text-muted-foreground">
          {statusView(track.currentStatus, locale).label}
        </p>
      </SectionCard>

      {/* Batch */}
      {batch ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-white px-3.5 py-3 text-[13.5px]">
          <span className="text-muted-foreground">🚚 {t('batch')}</span>
          <Link
            href={`/batches/${batch.id}`}
            className="font-semibold text-primary underline-offset-2 hover:underline"
          >
            {batch.name}
          </Link>
          {batch.etaDate ? (
            <span className="ml-auto font-mono text-[12px] text-muted-foreground">
              {batch.etaDate}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Weight + tariff + price */}
      <SectionCard>
        <WeightForm
          trackId={track.id}
          defaultWeight={defaultWeight}
          tariffs={tariffOptions}
          initialTariffId={track.tariffId}
          initialManual={track.priceManual}
          initialManualPriceSom={initialManualPriceSom}
          priceText={priceText}
          priceUsdText={priceUsdText}
        />
      </SectionCard>

      {/* Photo */}
      <SectionCard title={t('photo')}>
        {track.photoPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/tracks/${track.id}/photo`}
            alt={t('photoAlt', { code: track.codeOriginal })}
            className="max-h-80 w-auto rounded-lg border border-border"
          />
        ) : (
          <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-input text-sm text-muted-foreground">
            {t('noPhoto')}
          </div>
        )}
      </SectionCard>

      {/* Timeline */}
      <SectionCard title={t('history')}>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noEvents')}</p>
        ) : (
          <ol>
            {events.map((e, i) => {
              const v = statusView(e.status, locale);
              const last = i === events.length - 1;
              // An ownership change reuses the track's unchanged status in the
              // status column, so read `meta.action` to label it as what it
              // really was — otherwise the timeline shows the same status twice.
              const assignLabel = isAssignEventMeta(e.meta)
                ? assignLabels[e.meta.action]
                : undefined;
              return (
                <li key={e.id} className="flex gap-3">
                  <div className="flex flex-none flex-col items-center">
                    <span
                      className={cn(
                        'mt-1 h-2.5 w-2.5 rounded-full',
                        assignLabel && 'ring-2 ring-inset ring-white',
                      )}
                      style={{ background: assignLabel ? '#8a93a8' : v.dot }}
                    />
                    {!last ? (
                      <span className="my-1 w-0 flex-1 border-l-2 border-dotted border-input" />
                    ) : null}
                  </div>
                  <div className={cn('min-w-0', last ? 'pb-0' : 'pb-3.5')}>
                    <p className="text-[13.5px] font-semibold text-foreground">
                      {assignLabel ?? v.label}
                    </p>
                    <p className="mt-0.5 font-mono text-[11.5px] text-muted-foreground">
                      {formatDateTime(e.createdAt)}
                    </p>
                    {e.createdBy ? (
                      <p className="text-[12px] text-slate-600">{e.createdBy}</p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </SectionCard>

      {/* Customer card + attach/detach (SPEC §5.3, §7.3) */}
      <CustomerCard
        trackId={track.id}
        customer={
          customer
            ? {
                id: customer.id,
                clientCode: customer.clientCode,
                fullName: customer.fullName,
                phone: customer.phone,
              }
            : null
        }
      />

      {/* Status change + delete */}
      <TrackActions
        trackId={track.id}
        code={track.codeOriginal}
        currentStatus={track.currentStatus}
        customerId={track.customerId}
      />
    </div>
  );
}

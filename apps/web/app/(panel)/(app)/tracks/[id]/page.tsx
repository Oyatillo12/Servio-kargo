import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';

import {
  PIPELINE_ORDER,
  can,
  formatDateTime,
  formatKg,
  formatSom,
  formatUsd,
  isAssignEventMeta,
  storedChargeableWeight,
  type Lang,
  type TrackStatus,
} from '@kargotrack/shared';

import { MessageOutcomesCard } from '@/components/shared/message-outcomes';
import { StatusBadge } from '@/components/shared/status-badge';
import { DetailColumns, DetailShell } from '@/components/layout/detail-shell';
import { SectionCard } from '@/components/ui/section-card';
import { resolveTab, type TabItem } from '@/components/ui/tabs';
import { requireCapability } from '@/lib/auth';
import {
  getTrackDetail,
  listActiveTariffs,
  listTrackMessages,
  resolveActors,
} from '@/lib/queries';
import { statusView } from '@/lib/status-ui';
import { cn } from '@/lib/utils';
import { CustomerCard } from '@/features/tracks/components/customer-card';
import { MetaCard } from '@/features/tracks/components/meta-card';
import { PhotoCard } from '@/features/tracks/components/photo-card';
import {
  WeightForm,
  type TariffOption,
} from '@/features/tracks/components/weight-form';
import { TrackActions } from '@/features/tracks/components/track-actions';

export async function generateMetadata() {
  const t = await getTranslations('trackDetail');
  return { title: `${t('pageTitle')} — SERVIO Kargo` };
}

/** The four stages the China→Uzbekistan progress rail shows (SPEC §5.3). */
const RAIL: { key: TrackStatus; labelKey: string }[] = [
  { key: 'CHINA_WAREHOUSE', labelKey: 'railChina' },
  { key: 'IN_TRANSIT', labelKey: 'railTransit' },
  { key: 'TASHKENT_WAREHOUSE', labelKey: 'railTashkent' },
  { key: 'DELIVERED', labelKey: 'railDelivered' },
];

/**
 * The route rail: four stops on a line, in the colours the status chips use.
 *
 * Squares rather than emoji roundels (SPEC 5.0) — the stage a parcel is at is
 * a state, and states in this system are drawn, not illustrated. A stop that
 * has been passed is filled with its own status colour, the current one carries
 * a ring, and what is still ahead is a dashed outline: reachable at a glance in
 * grayscale, which a warehouse print-out is.
 */
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
    <div className="flex items-start">
      {RAIL.map((stage, i) => {
        const isActive = i === activeIndex;
        const dot = statusView(stage.key, 'uz').dot;
        return (
          <div key={stage.key} className="contents">
            {i > 0 ? (
              <div
                className={cn(
                  'mt-[13px] flex-1 border-t-2',
                  reached[i] ? 'border-solid' : 'border-dashed border-rule',
                )}
                style={reached[i] ? { borderColor: dot } : undefined}
              />
            ) : null}
            <div className="flex w-[76px] flex-none flex-col items-center gap-1.5">
              <span
                className={cn(
                  'h-7 w-7 rounded-sm border-2',
                  !reached[i] && 'border-dashed border-rule bg-surface',
                )}
                style={
                  reached[i]
                    ? {
                        borderColor: dot,
                        background: dot,
                        boxShadow: isActive ? `0 0 0 4px var(--signal-soft)` : undefined,
                      }
                    : undefined
                }
              />
              <span
                className={cn(
                  'text-center text-micro leading-tight',
                  isActive
                    ? 'font-semibold text-ink'
                    : reached[i]
                      ? 'font-medium text-ink-2'
                      : 'text-faint',
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
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string };
}) {
  const { tenant, role } = await requireCapability('tracks.view');
  const t = await getTranslations('trackDetail');
  const tCommon = await getTranslations('common');
  const tTracks = await getTranslations('tracks');
  const locale = (await getLocale()) as Lang;

  const [detail, activeTariffs] = await Promise.all([
    getTrackDetail(tenant.id, params.id),
    listActiveTariffs(tenant.id),
  ]);
  if (!detail) notFound();

  const { track, customer, batch, events, photos } = detail;
  const isUsd = tenant.currency === 'USD';

  // Outbound notifications about THIS parcel (tasks.md A3): "did the customer
  // actually hear that it arrived?" is asked per-track at the counter.
  const messages = await listTrackMessages(tenant.id, track.id);

  // Who did what, resolved once for the whole timeline (two queries, not one
  // per row). Before this the column printed the raw uuid.
  const actors = await resolveActors(
    tenant.id,
    events.map((e) => e.createdBy),
  );

  /** The one-line "by whom" under an event. Empty when there is nothing to say. */
  function actorLine(raw: string | null): string | null {
    if (!raw) return null;
    const actor = actors.get(raw);
    if (!actor) return null;
    switch (actor.kind) {
      case 'admin':
        // "· bot" marks a warehouse action taken over Telegram rather than in
        // the panel — same person, and an owner reading the trail cares which.
        return actor.viaBot
          ? `${actor.name ?? t('actorStaff')} · ${t('actorViaBot')}`
          : (actor.name ?? t('actorStaff'));
      case 'customer':
        return t('actorCustomer');
      case 'system':
        return t('actorSystem');
      default:
        return t('actorUnknown');
    }
  }

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

  // §7.16: read the FROZEN volumetric column, never a recomputation — a tariff
  // whose coefficient changed since must not restate what this parcel paid for.
  const charged = storedChargeableWeight(
    track.weightGrams,
    track.volumetricGrams,
  );
  const chargeableText =
    charged?.basis === 'volumetric'
      ? t('chargeableVolumetric', {
          kg: formatKg(charged.grams),
          actual: formatKg(track.weightGrams ?? 0),
        })
      : undefined;

  // The split (SPEC 5.0): everything needed to ACT on the parcel is in the
  // first tab, so weighing it, pricing it and handing it over never costs a
  // tap. Photos, the audit trail and the delivery log are evidence — opened
  // when a question is asked, not carried down the screen every time.
  const tabs: TabItem[] = [
    { key: 'umumiy', label: t('tabGeneral') },
    { key: 'photos', label: t('tabPhotos'), count: photos.length },
    { key: 'history', label: t('tabHistory'), count: events.length },
    { key: 'messages', label: t('tabMessages'), count: messages.length },
  ];
  const tab = resolveTab(tabs, searchParams.tab);
  const tabHref = (key: string) =>
    key === 'umumiy' ? `/tracks/${track.id}` : `/tracks/${track.id}?tab=${key}`;

  return (
    <DetailShell
      backHref="/tracks"
      backLabel={tTracks('pageTitle')}
      eyebrow={t('eyebrow')}
      title={<span className="font-mono">{track.codeOriginal}</span>}
      status={<StatusBadge status={track.currentStatus} />}
      rail={
        <div className="rounded-lg border border-rule bg-surface px-3.5 pb-3 pt-4">
          <RouteRail status={track.currentStatus} labels={railLabels} />
          <p className="mt-2 text-center text-micro text-faint">
            {statusView(track.currentStatus, locale).label}
          </p>
        </div>
      }
      tabs={tabs}
      activeTab={tab}
      buildTabHref={tabHref}
    >
      {tab === 'umumiy' ? (
        <DetailColumns
          main={
            <>
              {batch ? (
                <div className="flex items-center gap-2 rounded-lg border border-rule bg-surface px-3.5 py-3 text-small">
                  <span className="eyebrow">{t('batch')}</span>
                  <Link
                    href={`/batches/${batch.id}`}
                    className="font-semibold text-signal-strong underline-offset-2 hover:underline"
                  >
                    {batch.name}
                  </Link>
                  {batch.etaDate ? (
                    <span className="ms-auto font-mono text-micro text-faint">
                      {batch.etaDate}
                    </span>
                  ) : null}
                </div>
              ) : null}

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
                  initialDimensions={{
                    lengthCm: track.lengthCm != null ? String(track.lengthCm) : '',
                    widthCm: track.widthCm != null ? String(track.widthCm) : '',
                    heightCm: track.heightCm != null ? String(track.heightCm) : '',
                  }}
                  chargeableText={chargeableText}
                />
              </SectionCard>

              {/* Marka / tavsif / izoh (SPEC §7.13, tasks.md H1). */}
              <MetaCard
                trackId={track.id}
                marka={track.marka}
                description={track.description}
                note={track.note}
                canEdit={can(role, 'tracks.edit')}
              />
            </>
          }
          side={
            <>
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

              <TrackActions
                trackId={track.id}
                code={track.codeOriginal}
                currentStatus={track.currentStatus}
                customerId={track.customerId}
                role={role}
              />
            </>
          }
        />
      ) : null}

      {/* Photo gallery (SPEC §7.14): view for everyone, upload/delete behind
          tracks.weigh (the endpoints re-check). */}
      {tab === 'photos' ? (
        <PhotoCard
          trackId={track.id}
          code={track.codeOriginal}
          photos={photos}
          canEdit={can(role, 'tracks.weigh')}
        />
      ) : null}

      {tab === 'history' ? (
        <SectionCard title={t('history')}>
          {events.length === 0 ? (
            <p className="text-small text-muted-foreground">{t('noEvents')}</p>
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
                          'mt-1 h-2.5 w-2.5 rounded-[1px]',
                          assignLabel && 'ring-2 ring-inset ring-surface',
                        )}
                        style={{ background: assignLabel ? 'var(--ink-3)' : v.dot }}
                      />
                      {!last ? (
                        <span className="my-1 w-0 flex-1 border-l-2 border-dashed border-rule" />
                      ) : null}
                    </div>
                    <div className={cn('min-w-0', last ? 'pb-0' : 'pb-3.5')}>
                      <p className="text-small font-semibold text-foreground">
                        {assignLabel ?? v.label}
                      </p>
                      <p className="mt-0.5 font-mono text-micro text-faint">
                        {formatDateTime(e.createdAt)}
                      </p>
                      {actorLine(e.createdBy) ? (
                        <p className="text-micro text-ink-2">
                          {actorLine(e.createdBy)}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </SectionCard>
      ) : null}

      {tab === 'messages' ? <MessageOutcomesCard messages={messages} /> : null}
    </DetailShell>
  );
}

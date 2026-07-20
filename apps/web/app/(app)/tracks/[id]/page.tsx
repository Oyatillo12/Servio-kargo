import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Phone } from 'lucide-react';

import {
  PIPELINE_ORDER,
  formatKg,
  formatSom,
  formatUsd,
  type TrackStatus,
} from '@kargotrack/shared';

import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { requireAdmin } from '@/lib/auth';
import { formatDateTime } from '@/lib/datetime';
import { getTrackDetail, listActiveTariffs } from '@/lib/queries';
import { statusView } from '@/lib/status-ui';
import { cn } from '@/lib/utils';

import { WeightForm, type TariffOption } from './weight-form';
import { TrackActions } from './track-actions';

export const metadata = { title: 'Trek — SERVIO Kargo' };

const RAIL: { key: TrackStatus; label: string; emoji: string }[] = [
  { key: 'CHINA_WAREHOUSE', label: 'Xitoy', emoji: '📦' },
  { key: 'IN_TRANSIT', label: "Yo'lda", emoji: '🚚' },
  { key: 'TASHKENT_WAREHOUSE', label: 'Toshkent', emoji: '🇺🇿' },
  { key: 'DELIVERED', label: 'Topshirildi', emoji: '✅' },
];

/** Horizontal China→Uzbekistan progress rail (design screen 05). */
function RouteRail({ status }: { status: TrackStatus }) {
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
                {stage.label}
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
  const [detail, activeTariffs] = await Promise.all([
    getTrackDetail(tenant.id, params.id),
    listActiveTariffs(tenant.id),
  ]);
  if (!detail) notFound();

  const { track, customer, batch, events } = detail;
  const isUsd = tenant.currency === 'USD';

  const defaultWeight =
    track.weightGrams != null ? formatKg(track.weightGrams) : '';
  const priceText =
    track.priceTiyin != null ? `${formatSom(track.priceTiyin)} so'm` : '—';
  const priceUsdText =
    isUsd && track.priceUsdCents != null ? formatUsd(track.priceUsdCents) : undefined;

  const tariffOptions: TariffOption[] = activeTariffs.map((tf) => ({
    id: tf.id,
    label: isUsd
      ? `${tf.name} · ${formatUsd(tf.pricePerKgMinor)}/kg`
      : `${tf.name} · ${formatSom(tf.pricePerKgMinor)} so'm/kg`,
  }));
  const initialManualPriceSom =
    track.priceManual && track.priceTiyin != null
      ? String(Math.round(track.priceTiyin / 100))
      : '';

  const initials = (customer?.fullName ?? '')
    .split(' ')
    .map((p) => p.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="mx-auto max-w-md space-y-3">
      <Link
        href="/tracks"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Treklar
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-mono text-xl font-semibold text-foreground">
          {track.codeOriginal}
        </h1>
        <StatusBadge status={track.currentStatus} />
      </div>

      {/* Route rail */}
      <div className="rounded-xl border border-border bg-white px-3.5 pb-3.5 pt-4">
        <RouteRail status={track.currentStatus} />
        <p className="mt-2.5 text-center text-xs text-muted-foreground">
          {statusView(track.currentStatus).label}
        </p>
      </div>

      {/* Batch (Reys) */}
      {batch ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-white px-3.5 py-3 text-[13.5px]">
          <span className="text-muted-foreground">🚚 Reys:</span>
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
      <div className="rounded-xl border border-border bg-white p-3.5">
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
      </div>

      {/* Photo */}
      <div className="rounded-xl border border-border bg-white p-3.5">
        <h2 className="mb-2.5 text-[13.5px] font-semibold text-foreground">
          Ombor rasmi
        </h2>
        {track.photoPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/tracks/${track.id}/photo`}
            alt={`${track.codeOriginal} ombor rasmi`}
            className="max-h-80 w-auto rounded-lg border border-border"
          />
        ) : (
          <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-input text-sm text-muted-foreground">
            Rasm yo&apos;q
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="rounded-xl border border-border bg-white p-3.5">
        <h2 className="mb-3 text-[13.5px] font-semibold text-foreground">
          Tarix
        </h2>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Hodisalar yo&apos;q.</p>
        ) : (
          <ol>
            {events.map((e, i) => {
              const v = statusView(e.status);
              const last = i === events.length - 1;
              return (
                <li key={e.id} className="flex gap-3">
                  <div className="flex flex-none flex-col items-center">
                    <span
                      className="mt-1 h-2.5 w-2.5 rounded-full"
                      style={{ background: v.dot }}
                    />
                    {!last ? (
                      <span className="my-1 w-0 flex-1 border-l-2 border-dotted border-input" />
                    ) : null}
                  </div>
                  <div className={cn('min-w-0', last ? 'pb-0' : 'pb-3.5')}>
                    <p className="text-[13.5px] font-semibold text-foreground">
                      {v.label}
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
      </div>

      {/* Customer card */}
      <div className="rounded-xl border border-border bg-white p-3.5">
        {customer ? (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-accent text-sm font-bold text-primary">
              {initials || '—'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                {customer.fullName ?? 'Ismi yo‘q'}
              </p>
              <p className="truncate font-mono text-[12px] text-muted-foreground">
                {customer.clientCode}
                {customer.phone ? ` · ${customer.phone}` : ''}
              </p>
            </div>
            <div className="flex flex-none items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/customers/${customer.id}`}>Profil</Link>
              </Button>
              {customer.phone ? (
                <Button asChild variant="outline" size="icon" aria-label="Qo'ng'iroq">
                  <a href={`tel:${customer.phone}`}>
                    <Phone className="h-4 w-4" />
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Mijozga biriktirilmagan.
          </p>
        )}
      </div>

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

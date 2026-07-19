import Link from 'next/link';
import { notFound } from 'next/navigation';

import { formatKg, formatSom } from '@kargotrack/shared';

import { StatusBadge } from '@/components/status-badge';
import { requireAdmin } from '@/lib/auth';
import { formatDateTime } from '@/lib/datetime';
import { getTrackDetail } from '@/lib/queries';
import { statusView } from '@/lib/status-ui';

import { WeightForm } from './weight-form';

export const metadata = { title: 'Trek — KargoTrack' };

export default async function TrackDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { tenant } = await requireAdmin();
  const detail = await getTrackDetail(tenant.id, params.id);
  if (!detail) notFound();

  const { track, customer, events } = detail;

  const defaultWeight =
    track.weightGrams != null ? formatKg(track.weightGrams) : '';
  const priceText =
    track.priceTiyin != null ? `${formatSom(track.priceTiyin)} so'm` : '—';

  return (
    <div className="space-y-4">
      <Link
        href="/tracks"
        className="inline-block text-sm text-slate-500 hover:text-slate-800"
      >
        ← Treklar
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-mono text-lg font-bold text-slate-900">
          {track.codeOriginal}
        </h1>
        <StatusBadge status={track.currentStatus} />
      </div>

      {/* Customer card */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Mijoz</h2>
        {customer ? (
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Kod</dt>
              <dd className="font-medium text-slate-800">
                {customer.clientCode}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Ism</dt>
              <dd className="text-slate-800">{customer.fullName ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Telefon</dt>
              <dd className="text-slate-800">{customer.phone ?? '—'}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-slate-400">Mijozga biriktirilmagan.</p>
        )}
      </section>

      {/* Weight + price */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          Og'irlik va narx
        </h2>
        <WeightForm
          trackId={track.id}
          defaultWeight={defaultWeight}
          priceText={priceText}
        />
      </section>

      {/* Photo */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          Ombor rasmi
        </h2>
        {track.photoPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/tracks/${track.id}/photo`}
            alt={`${track.codeOriginal} ombor rasmi`}
            className="max-h-80 w-auto rounded-lg border border-slate-200"
          />
        ) : (
          <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-400">
            Rasm yo'q
          </div>
        )}
      </section>

      {/* Event timeline */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          Holatlar tarixi
        </h2>
        {events.length === 0 ? (
          <p className="text-sm text-slate-400">Hodisalar yo'q.</p>
        ) : (
          <ol className="space-y-3">
            {events.map((e) => {
              const v = statusView(e.status);
              return (
                <li key={e.id} className="flex gap-3">
                  <span aria-hidden className="mt-0.5 text-base">
                    {v.emoji}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">
                      {v.label}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDateTime(e.createdAt)}
                      {e.createdBy ? ` · ${e.createdBy}` : ''}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}

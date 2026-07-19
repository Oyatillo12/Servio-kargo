import Link from 'next/link';

import {
  STATUS_META,
  TRACK_STATUSES,
  formatDate,
  formatKg,
  formatSom,
  type TrackStatus,
} from '@kargotrack/shared';

import { requireAdmin } from '@/lib/auth';
import { listTracks } from '@/lib/queries';

import { TracksTable, type TrackRowView } from './tracks-table';

export const metadata = { title: 'Treklar — KargoTrack' };

function isStatus(v: string | undefined): v is TrackStatus {
  return !!v && (TRACK_STATUSES as readonly string[]).includes(v);
}

interface SearchParams {
  q?: string;
  status?: string;
  page?: string;
}

export default async function TracksPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { tenant } = await requireAdmin();

  const q = searchParams.q?.trim() ?? '';
  const status = isStatus(searchParams.status) ? searchParams.status : undefined;
  const page = Math.max(1, Number(searchParams.page) || 1);

  const result = await listTracks({ tenantId: tenant.id, q, status, page });

  const rows: TrackRowView[] = result.rows.map((r) => ({
    id: r.id,
    code: r.codeOriginal,
    status: r.currentStatus,
    customerLabel:
      r.clientCode || r.customerName
        ? `${r.clientCode ?? ''}${r.clientCode && r.customerName ? ' · ' : ''}${
            r.customerName ?? ''
          }`
        : null,
    weightText: r.weightGrams != null ? `${formatKg(r.weightGrams)} kg` : '—',
    priceText: r.priceTiyin != null ? `${formatSom(r.priceTiyin)} so'm` : '—',
    dateText: formatDate(r.createdAt),
  }));

  // Preserve filters across pagination links.
  const buildHref = (targetPage: number) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    if (targetPage > 1) params.set('page', String(targetPage));
    const qs = params.toString();
    return qs ? `/tracks?${qs}` : '/tracks';
  };

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h1 className="text-lg font-bold text-slate-900">Treklar</h1>
        <span className="text-sm text-slate-500">{result.total} ta</span>
      </div>

      <form method="get" className="mb-4 flex flex-col gap-2 sm:flex-row">
        <input
          name="q"
          defaultValue={q}
          placeholder="Kod, ism yoki telefon bo'yicha qidirish"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
        />
        <select
          name="status"
          defaultValue={status ?? ''}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
        >
          <option value="">Barcha statuslar</option>
          {TRACK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].emoji} {STATUS_META[s].uz}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Qidirish
        </button>
      </form>

      <TracksTable rows={rows} />

      {result.pages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-sm">
          {result.page > 1 ? (
            <Link
              href={buildHref(result.page - 1)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
            >
              ◀️ Oldingi
            </Link>
          ) : (
            <span />
          )}
          <span className="text-slate-500">
            {result.page} / {result.pages}
          </span>
          {result.page < result.pages ? (
            <Link
              href={buildHref(result.page + 1)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
            >
              Keyingi ▶️
            </Link>
          ) : (
            <span />
          )}
        </div>
      ) : null}
    </div>
  );
}

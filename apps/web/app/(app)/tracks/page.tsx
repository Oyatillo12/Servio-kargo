import Link from 'next/link';

import {
  STATUS_META,
  TRACK_STATUSES,
  formatDate,
  formatKg,
  formatSom,
  isTrackWorklist,
  worklistLabel,
  type TrackStatus,
} from '@kargotrack/shared';

import { requireAdmin } from '@/lib/auth';
import { listBatches, listTracks } from '@/lib/queries';
import { Input } from '@/components/ui/input';
import { ExportButton } from '@/components/export-button';
import { PageHeader } from '@/components/page-header';
import { cn } from '@/lib/utils';
import { WORKLIST_ICONS } from '@/lib/worklist-ui';

import { TracksTable, type TrackRowView } from './tracks-table';
import { BatchFilter } from './batch-filter';
import type { BatchOption } from './batch-assign-dialog';

export const metadata = { title: 'Treklar — SERVIO Kargo' };

function isStatus(v: string | undefined): v is TrackStatus {
  return !!v && (TRACK_STATUSES as readonly string[]).includes(v);
}

interface SearchParams {
  q?: string;
  status?: string;
  batch?: string;
  /** Operational worklist from the dashboard (AUDIT.md T19). */
  work?: string;
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
  // A worklist already pins the status (e.g. `to_weigh` ⊂ CHINA_WAREHOUSE), so
  // the two filters are alternatives, not layers: the status chips are replaced
  // by the worklist banner while one is active. Unknown value → no filter,
  // matching how `status` degrades, so a stale bookmark still opens.
  const work = isTrackWorklist(searchParams.work) ? searchParams.work : undefined;
  const page = Math.max(1, Number(searchParams.page) || 1);

  const batchRows = await listBatches(tenant.id);
  const batchId = batchRows.some((b) => b.id === searchParams.batch)
    ? searchParams.batch
    : undefined;

  const result = await listTracks({
    tenantId: tenant.id,
    q,
    status,
    batchId,
    work,
    page,
  });

  const batchOptions: BatchOption[] = batchRows.map((b) => ({
    id: b.id,
    label: b.name,
  }));

  const rows: TrackRowView[] = result.rows.map((r) => ({
    id: r.id,
    code: r.codeOriginal,
    status: r.currentStatus,
    customerId: r.customerId,
    customerLabel:
      r.clientCode || r.customerName
        ? `${r.clientCode ?? ''}${r.clientCode && r.customerName ? ' · ' : ''}${
            r.customerName ?? ''
          }`
        : null,
    batchName: r.batchName,
    weightText: r.weightGrams != null ? `${formatKg(r.weightGrams)} kg` : '—',
    priceText: r.priceTiyin != null ? `${formatSom(r.priceTiyin)} so'm` : '—',
    dateText: formatDate(r.createdAt),
  }));

  // Filter chip link, preserving the search term + batch filter. `work` is
  // deliberately dropped: picking a status chip means leaving the worklist.
  const chipHref = (target?: TrackStatus) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (batchId) params.set('batch', batchId);
    if (target) params.set('status', target);
    const qs = params.toString();
    return qs ? `/tracks?${qs}` : '/tracks';
  };

  // Excel export of exactly what the current filters select (AUDIT.md T2).
  const exportParams = new URLSearchParams();
  if (q) exportParams.set('q', q);
  if (status) exportParams.set('status', status);
  if (batchId) exportParams.set('batch', batchId);
  if (work) exportParams.set('work', work);
  const exportHref = `/api/export/tracks${
    exportParams.toString() ? `?${exportParams}` : ''
  }`;

  // Pagination link, preserving filters.
  const pageHref = (targetPage: number) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    if (batchId) params.set('batch', batchId);
    if (work) params.set('work', work);
    if (targetPage > 1) params.set('page', String(targetPage));
    const qs = params.toString();
    return qs ? `/tracks?${qs}` : '/tracks';
  };

  const chip = (label: string, target: TrackStatus | undefined, active: boolean) => (
    <Link
      key={label}
      href={chipHref(target)}
      className={cn(
        'flex-none rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'border-primary bg-primary text-white'
          : 'border-input bg-white text-slate-600 hover:bg-secondary',
      )}
    >
      {label}
    </Link>
  );

  return (
    <div>
      <PageHeader
        title="Treklar"
        right={
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              jami{' '}
              <span className="font-mono font-semibold">{result.total}</span>
            </span>
            <ExportButton href={exportHref} />
          </div>
        }
      />

      <div className="mb-3 flex gap-2">
        <form method="get" className="flex-1">
          <input type="hidden" name="status" value={status ?? ''} />
          {batchId ? <input type="hidden" name="batch" value={batchId} /> : null}
          {work ? <input type="hidden" name="work" value={work} /> : null}
          <Input
            name="q"
            defaultValue={q}
            placeholder="Trek kodi yoki mijoz qidirish"
            className="h-11 bg-[#f7f8fa]"
          />
        </form>
        {batchRows.length > 0 ? (
          <BatchFilter
            batches={batchRows.map((b) => ({ id: b.id, name: b.name }))}
            current={batchId}
            q={q}
            status={status}
          />
        ) : null}
      </div>

      {work ? (
        /* Came from the dashboard's "Bugungi ish" (AUDIT.md T19). The status
           chips are hidden rather than shown inactive: a worklist already
           implies a status, so a chip tapped on top of it would look like a
           second filter and return nothing. One obvious way out instead. */
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-[#f0e0c2] bg-[#fffbf3] px-3 py-2.5">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#fdf0d8] text-base leading-none">
            {WORKLIST_ICONS[work]}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-foreground">
              {worklistLabel(work, 'uz').label}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {worklistLabel(work, 'uz').hint}
            </p>
          </div>
          <Link
            href={chipHref()}
            className="flex-none rounded-full border border-input bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-secondary"
          >
            ✕ Filtrsiz
          </Link>
        </div>
      ) : (
        <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {chip('Barchasi', undefined, !status)}
          {TRACK_STATUSES.map((s) => chip(STATUS_META[s].uz, s, status === s))}
        </div>
      )}

      <TracksTable rows={rows} batches={batchOptions} />

      {result.pages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-sm">
          {result.page > 1 ? (
            <Link
              href={pageHref(result.page - 1)}
              className="rounded-lg border border-input bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-secondary"
            >
              ← Oldingi
            </Link>
          ) : (
            <span />
          )}
          <span className="font-mono text-muted-foreground">
            {result.page} / {result.pages}
          </span>
          {result.page < result.pages ? (
            <Link
              href={pageHref(result.page + 1)}
              className="rounded-lg border border-input bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-secondary"
            >
              Keyingi →
            </Link>
          ) : (
            <span />
          )}
        </div>
      ) : null}
    </div>
  );
}

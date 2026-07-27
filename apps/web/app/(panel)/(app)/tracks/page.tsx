import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { X } from 'lucide-react';

import {
  STATUS_META,
  TRACK_STATUSES,
  can,
  formatDate,
  formatKg,
  formatSom,
  isTrackWorklist,
  worklistLabel,
  type Lang,
  type TrackStatus,
} from '@kargotrack/shared';

import { requireCapability } from '@/lib/auth';
import { listBatches, listTracks } from '@/lib/queries';
import { ExportButton } from '@/components/shared/export-button';
import { FilterChips, type FilterChip } from '@/components/shared/filter-chips';
import { Pagination } from '@/components/shared/pagination';
import { SearchField } from '@/components/shared/search-field';
import { PageHeader } from '@/components/layout/page-header';
import { WORKLIST_ICONS } from '@/lib/worklist-ui';
import {
  TracksTable,
  type TrackRowView,
} from '@/features/tracks/components/tracks-table';
import { BatchFilter } from '@/features/tracks/components/batch-filter';
import type { BatchOption } from '@/features/tracks/components/batch-assign-dialog';

export async function generateMetadata() {
  const t = await getTranslations('tracks');
  return { title: `${t('pageTitle')} — SERVIO Kargo` };
}

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
  const { tenant, role } = await requireCapability('tracks.view');
  const t = await getTranslations('tracks');
  const tCommon = await getTranslations('common');
  const locale = (await getLocale()) as Lang;

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
    weightText:
      r.weightGrams != null
        ? `${formatKg(r.weightGrams)} ${tCommon('kg')}`
        : tCommon('dash'),
    priceText:
      r.priceTiyin != null
        ? `${formatSom(r.priceTiyin)} ${tCommon('som')}`
        : tCommon('dash'),
    dateText: formatDate(r.createdAt),
  }));

  // Filter chip link, preserving the search term + batch filter. `work` is
  // deliberately dropped: picking a status chip means leaving the worklist.
  const chipHref = (target?: string) => {
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

  // Pagination link, preserving every active filter.
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

  const statusChips: FilterChip[] = [
    { value: undefined, label: t('allStatuses') },
    ...TRACK_STATUSES.map((s) => ({
      value: s as string,
      label: STATUS_META[s][locale],
      emoji: STATUS_META[s].emoji,
    })),
  ];

  return (
    <div>
      <PageHeader
        title={t('pageTitle')}
        count={result.total}
        right={can(role, 'export.data') ? <ExportButton href={exportHref} /> : null}
      />

      <div className="mb-3 flex gap-2">
        <SearchField
          path="/tracks"
          value={q}
          placeholder={t('searchPlaceholder')}
          label={t('searchPlaceholder')}
          keep={{ status, batch: batchId, work }}
        />
        {batchRows.length > 0 ? (
          <BatchFilter
            batches={batchRows.map((b) => ({ id: b.id, name: b.name }))}
            current={batchId}
            q={q}
            status={status}
            work={work}
          />
        ) : null}
      </div>

      {work ? (
        /* Came from the dashboard's work queue (AUDIT.md T19). The status chips
           are hidden rather than shown inactive: a worklist already implies a
           status, so a chip tapped on top of it would look like a second filter
           and return nothing. One obvious way out instead. */
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-[#f0e0c2] bg-[#fffbf3] px-3 py-2.5">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#fdf0d8] text-warning">
            {(() => {
              const Icon = WORKLIST_ICONS[work];
              return <Icon className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden />;
            })()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-foreground">
              {worklistLabel(work, locale).label}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {worklistLabel(work, locale).hint}
            </p>
          </div>
          <Link
            href={chipHref()}
            className="flex flex-none items-center gap-1 rounded-full border border-input bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-secondary"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            {t('clearFilter')}
          </Link>
        </div>
      ) : (
        <FilterChips
          className="mb-4"
          chips={statusChips}
          active={status}
          buildHref={chipHref}
          label={t('colStatus')}
        />
      )}

      <TracksTable rows={rows} batches={batchOptions} role={role} />

      <Pagination page={result.page} pages={result.pages} buildHref={pageHref} />
    </div>
  );
}

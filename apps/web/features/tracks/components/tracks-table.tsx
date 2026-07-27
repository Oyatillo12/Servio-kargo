'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import type { TrackStatus } from '@kargotrack/shared';

import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  tableHeadRowClass,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

import { StatusChangeDialog, type StatusTarget } from './status-change-dialog';
import { BatchAssignDialog, type BatchOption } from './batch-assign-dialog';
import { CustomerAssignDialog } from './customer-assign-dialog';

export interface TrackRowView {
  id: string;
  code: string;
  status: TrackStatus;
  customerId: string | null;
  customerLabel: string | null;
  batchName: string | null;
  weightText: string;
  priceText: string;
  dateText: string;
}

/**
 * Tracks list with bulk-select (SPEC §5.2): a card list on mobile, a table on
 * desktop (design 02 / 14). Selecting rows reveals a bulk bar with three
 * actions: customer assignment, batch assignment and status change.
 */
export function TracksTable({
  rows,
  batches,
}: {
  rows: TrackRowView[];
  batches: BatchOption[];
}) {
  const t = useTranslations('tracks');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);

  /**
   * Optimistic status overlay (AUDIT.md T15). A bulk status change round-trips
   * through a server action and then a `router.refresh()`; on a 300-row page
   * over a phone connection that is a second or more of the badges still
   * reading the old status, which looks like the tap never registered and gets
   * tapped again. The overlay paints the new status immediately and is dropped
   * as soon as the server's own rows arrive.
   */
  const [optimistic, setOptimistic] = useState<Map<string, TrackStatus>>(
    new Map(),
  );
  useEffect(() => setOptimistic(new Map()), [rows]);

  const view = useMemo(
    () =>
      optimistic.size === 0
        ? rows
        : rows.map((r) => {
            const next = optimistic.get(r.id);
            return next ? { ...r, status: next } : r;
          }),
    [rows, optimistic],
  );

  const allSelected = view.length > 0 && selected.size === view.length;
  const someSelected = selected.size > 0 && !allSelected;

  const rowById = useMemo(() => new Map(view.map((r) => [r.id, r])), [view]);

  const targets: StatusTarget[] = useMemo(
    () =>
      [...selected]
        .map((id) => rowById.get(id))
        .filter((r): r is TrackRowView => !!r)
        .map((r) => ({
          id: r.id,
          currentStatus: r.status,
          customerId: r.customerId,
        })),
    [selected, rowById],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(view.map((r) => r.id)));
  }

  function afterStatusChange(ids: string[], status: TrackStatus) {
    setOptimistic(new Map(ids.map((id) => [id, status])));
    setSelected(new Set());
    router.refresh();
  }

  if (view.length === 0) {
    return <EmptyState title={t('emptyTitle')} hint={t('emptyHint')} />;
  }

  return (
    <div>
      {selected.size > 0 ? (
        <BulkBar
          count={selected.size}
          onClear={() => setSelected(new Set())}
          onCustomer={() => setCustomerOpen(true)}
          onBatch={() => setBatchOpen(true)}
          onStatus={() => setDialogOpen(true)}
        />
      ) : null}

      {/* Mobile: card rows */}
      <div className="overflow-hidden rounded-xl border border-border bg-white md:hidden">
        {view.map((r) => {
          const checked = selected.has(r.id);
          return (
            <div
              key={r.id}
              className={cn(
                'flex gap-3 border-b border-[#eef0f4] px-4 py-3 transition-colors last:border-0',
                checked && 'bg-[#f3f5fb]',
              )}
            >
              <Checkbox
                className="mt-0.5"
                checked={checked}
                onCheckedChange={() => toggle(r.id)}
                aria-label={t('selectRow', { code: r.code })}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <Link
                    href={`/tracks/${r.id}`}
                    className="truncate font-mono text-[13.5px] font-semibold text-foreground underline-offset-2 hover:underline"
                  >
                    {r.code}
                  </Link>
                  <StatusBadge status={r.status} />
                </div>
                <p className="mt-1 truncate text-[13px] text-slate-600">
                  {r.customerLabel ?? (
                    <span className="text-slate-400">
                      {tCommon('unassigned')}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 font-mono text-[12px] text-muted-foreground">
                  {r.weightText} · {r.priceText} · {r.dateText}
                </p>
                {r.batchName ? (
                  <p className="mt-0.5 text-[11.5px] text-primary">
                    🚚 {r.batchName}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <tr className={tableHeadRowClass}>
              <th className="w-10 px-4 py-2.5">
                <Checkbox
                  checked={
                    allSelected ? true : someSelected ? 'indeterminate' : false
                  }
                  onCheckedChange={toggleAll}
                  aria-label={t('selectAll')}
                />
              </th>
              <TableHead>{t('colCode')}</TableHead>
              <TableHead>{t('colCustomer')}</TableHead>
              <TableHead>{t('colStatus')}</TableHead>
              <TableHead>{t('colBatch')}</TableHead>
              <TableHead className="text-right">{t('colWeight')}</TableHead>
              <TableHead className="text-right">{t('colPrice')}</TableHead>
              <TableHead className="text-right">{t('colDate')}</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {view.map((r) => {
              const checked = selected.has(r.id);
              return (
                <TableRow key={r.id} selected={checked}>
                  <TableCell className="px-4">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggle(r.id)}
                      aria-label={t('selectRow', { code: r.code })}
                    />
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/tracks/${r.id}`}
                      className="font-mono font-semibold text-foreground underline-offset-2 hover:underline"
                    >
                      {r.code}
                    </Link>
                  </TableCell>
                  <TableCell className="text-slate-700">
                    {r.customerLabel ?? (
                      <span className="text-slate-400">
                        {tCommon('unassigned')}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-slate-700">
                    {r.batchName ?? (
                      <span className="text-slate-400">{tCommon('dash')}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-slate-700">
                    {r.weightText}
                  </TableCell>
                  <TableCell className="text-right font-mono text-slate-700">
                    {r.priceText}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right font-mono text-muted-foreground">
                    {r.dateText}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <StatusChangeDialog
        targets={targets}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onDone={afterStatusChange}
      />

      <BatchAssignDialog
        trackIds={[...selected]}
        batches={batches}
        open={batchOpen}
        onOpenChange={setBatchOpen}
        onDone={() => setSelected(new Set())}
      />

      <CustomerAssignDialog
        trackIds={[...selected]}
        open={customerOpen}
        onOpenChange={setCustomerOpen}
        onDone={() => setSelected(new Set())}
      />
    </div>
  );
}

/**
 * Sticky action bar shown while rows are selected.
 *
 * It sticks below the 56px app header on mobile (`top-[60px]`) rather than at
 * the top of the scroll container: the header is itself sticky and would cover
 * the bar exactly when the admin scrolls down to select more rows.
 */
function BulkBar({
  count,
  onClear,
  onCustomer,
  onBatch,
  onStatus,
}: {
  count: number;
  onClear: () => void;
  onCustomer: () => void;
  onBatch: () => void;
  onStatus: () => void;
}) {
  const t = useTranslations('tracks');

  return (
    <div
      role="toolbar"
      aria-label={t('selectedCount', { count })}
      className="animate-fade-in-up sticky top-[60px] z-[5] mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-primary px-3 py-2.5 text-white shadow-lg shadow-primary/20 md:top-2"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onClear}
          className="rounded text-sm font-medium text-white/80 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          {t('clearSelection')}
        </button>
        <span className="text-sm font-semibold tabular-nums">
          {t('selectedCount', { count })}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="border-transparent bg-white/15 text-white hover:bg-white/25"
          onClick={onCustomer}
        >
          {t('bulkAssignCustomer')}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="border-transparent bg-white/15 text-white hover:bg-white/25"
          onClick={onBatch}
        >
          {t('bulkAssignBatch')}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="border-transparent bg-white text-primary hover:bg-white/90"
          onClick={onStatus}
        >
          {t('bulkChangeStatus')}
        </Button>
      </div>
    </div>
  );
}

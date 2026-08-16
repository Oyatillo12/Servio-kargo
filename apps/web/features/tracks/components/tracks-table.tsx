'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';

import { can, type TrackStatus } from '@kargotrack/shared';

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
  role,
}: {
  rows: TrackRowView[];
  batches: BatchOption[];
  role: string;
}) {
  const t = useTranslations('tracks');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  /**
   * Track being attached from its own row (AUDIT.md T11). Attaching owners is
   * the daily job behind `/tracks?work=unassigned`, and going through the bulk
   * bar for it costs three taps per parcel: tick the box, open the bar, pick.
   * The grey "Biriktirilmagan" cell IS the button — it is already the thing the
   * admin is looking at when they decide to act, and it needs no new column.
   */
  const [quickTarget, setQuickTarget] = useState<string | null>(null);

  const canAssign = can(role, 'tracks.assign');

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
          canAssign={canAssign}
          onClear={() => setSelected(new Set())}
          onCustomer={() => setCustomerOpen(true)}
          onBatch={() => setBatchOpen(true)}
          onStatus={() => setDialogOpen(true)}
        />
      ) : null}

      {/* Mobile: card rows */}
      <div className="-mx-4 border-y border-rule bg-surface md:hidden">
        {view.map((r) => {
          const checked = selected.has(r.id);
          return (
            <div
              key={r.id}
              className={cn(
                'flex gap-3 border-b border-rule-soft px-4 py-3 transition-colors last:border-0',
                checked && 'bg-signal-soft',
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
                    className="truncate font-mono text-small font-semibold text-foreground underline-offset-2 hover:underline"
                  >
                    {r.code}
                  </Link>
                  <StatusBadge status={r.status} />
                </div>
                <div className="mt-1 truncate text-small text-ink-2">
                  <CustomerCell
                    row={r}
                    canAssign={canAssign}
                    onAssign={() => setQuickTarget(r.id)}
                  />
                </div>
                <p className="mt-0.5 font-mono text-micro text-faint">
                  {r.weightText} · {r.priceText} · {r.dateText}
                </p>
                {r.batchName ? (
                  <p className="mt-0.5 text-micro text-signal-strong">
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
                  <TableCell className="text-ink-2">
                    <CustomerCell
                      row={r}
                      canAssign={canAssign}
                      onAssign={() => setQuickTarget(r.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-ink-2">
                    {r.batchName ?? (
                      <span className="text-faint">{tCommon('dash')}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-ink-2">
                    {r.weightText}
                  </TableCell>
                  <TableCell className="text-right font-mono text-ink-2">
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

      {/* Same dialog, one track: the row-level attach (AUDIT.md T11). It is a
          separate instance rather than a shared one with a swapped id list, so
          opening it never disturbs an in-progress bulk selection. */}
      <CustomerAssignDialog
        trackIds={quickTarget ? [quickTarget] : []}
        open={quickTarget != null}
        onOpenChange={(open) => {
          if (!open) setQuickTarget(null);
        }}
        onDone={() => {
          setQuickTarget(null);
          // The row must stop saying "Biriktirilmagan" — on the unassigned
          // worklist it should leave the list entirely.
          router.refresh();
        }}
      />
    </div>
  );
}

/**
 * The customer column: the owner's label, or — for an unclaimed track — the
 * button that attaches one (AUDIT.md T11).
 *
 * Warehouse staff see the plain grey text instead: they move parcels, they do
 * not decide whose they are (CLAUDE.md rule 9). The server action checks the
 * same capability regardless.
 */
function CustomerCell({
  row,
  canAssign,
  onAssign,
}: {
  row: TrackRowView;
  canAssign: boolean;
  onAssign: () => void;
}) {
  const t = useTranslations('tracks');
  const tCommon = useTranslations('common');

  if (row.customerLabel) return <>{row.customerLabel}</>;
  if (!canAssign) {
    return <span className="text-faint">{tCommon('unassigned')}</span>;
  }

  return (
    <button
      type="button"
      onClick={onAssign}
      aria-label={t('quickAssignRow', { code: row.code })}
      className="inline-flex items-center gap-1 rounded-sm border border-dashed border-input px-2 py-0.5 text-micro font-medium text-faint transition-colors hover:border-signal hover:bg-signal-soft hover:text-signal-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Plus className="h-3 w-3 flex-none" strokeWidth={2} aria-hidden />
      {t('quickAssign')}
    </button>
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
  canAssign,
  onClear,
  onCustomer,
  onBatch,
  onStatus,
}: {
  count: number;
  /** Warehouse staff move parcels but do not decide whose they are. */
  canAssign: boolean;
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
      /* Ink, not signal: this bar appears over a list the admin is reading, and
         a full-width orange slab there fights the rows it is meant to act on.
         Black reads as a tool that was pulled out and will be put away; the one
         signal-coloured thing on it is the action that changes the parcels. */
      className="animate-fade-in-up sticky top-[52px] z-[5] mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md bg-ink px-3 py-2.5 text-white shadow-lg md:top-2"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onClear}
          className="rounded-sm text-small font-medium text-white/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          {t('clearSelection')}
        </button>
        <span className="font-mono text-small font-semibold tabular-nums">
          {t('selectedCount', { count })}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {canAssign ? (
          <>
            <Button
              variant="secondary"
              size="sm"
              className="border-transparent bg-surface/15 text-white hover:bg-surface/25"
              onClick={onCustomer}
            >
              {t('bulkAssignCustomer')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="border-transparent bg-surface/15 text-white hover:bg-surface/25"
              onClick={onBatch}
            >
              {t('bulkAssignBatch')}
            </Button>
          </>
        ) : null}
        <Button
          variant="secondary"
          size="sm"
          className="border-transparent bg-signal text-white hover:bg-signal-strong"
          onClick={onStatus}
        >
          {t('bulkChangeStatus')}
        </Button>
      </div>
    </div>
  );
}

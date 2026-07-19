'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import type { TrackStatus } from '@kargotrack/shared';

import { StatusBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

import { StatusChangeDialog, type StatusTarget } from './status-change-dialog';
import { BatchAssignDialog, type BatchOption } from './batch-assign-dialog';

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
 * desktop (design 02 / 14). Selecting rows reveals a bulk bar with two actions:
 * status change and batch assignment.
 */
export function TracksTable({
  rows,
  batches,
}: {
  rows: TrackRowView[];
  batches: BatchOption[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);

  const allSelected = rows.length > 0 && selected.size === rows.length;

  const rowById = useMemo(
    () => new Map(rows.map((r) => [r.id, r])),
    [rows],
  );

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
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title="Trek topilmadi"
        hint="Qidiruv yoki filtrni o'zgartirib ko'ring."
      />
    );
  }

  return (
    <div>
      {selected.size > 0 ? (
        <div className="sticky top-[60px] z-[5] mb-3 flex items-center justify-between rounded-xl bg-primary px-3 py-2.5 text-white shadow-sm md:top-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-sm font-medium text-white/80 hover:text-white"
            >
              Bekor
            </button>
            <span className="text-sm font-semibold">
              {selected.size} ta tanlandi
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="border-transparent bg-white/15 text-white hover:bg-white/25"
              onClick={() => setBatchOpen(true)}
            >
              Reysga biriktirish
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="border-transparent bg-white text-primary hover:bg-white/90"
              onClick={() => setDialogOpen(true)}
            >
              Status o&apos;zgartirish
            </Button>
          </div>
        </div>
      ) : null}

      {/* Mobile: card rows */}
      <div className="overflow-hidden rounded-xl border border-border bg-white md:hidden">
        {rows.map((r) => {
          const checked = selected.has(r.id);
          return (
            <div
              key={r.id}
              className={cn(
                'flex gap-3 border-b border-[#eef0f4] px-4 py-3 last:border-0',
                checked && 'bg-[#f3f5fb]',
              )}
            >
              <Checkbox
                className="mt-0.5"
                checked={checked}
                onCheckedChange={() => toggle(r.id)}
                aria-label={`${r.code} ni tanlash`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <Link
                    href={`/tracks/${r.id}`}
                    className="truncate font-mono text-[13.5px] font-semibold text-foreground"
                  >
                    {r.code}
                  </Link>
                  <StatusBadge status={r.status} />
                </div>
                <p className="mt-1 truncate text-[13px] text-slate-600">
                  {r.customerLabel ?? (
                    <span className="text-slate-400">Biriktirilmagan</span>
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
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-white md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="w-10 px-4 py-2.5">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Barchasini tanlash"
                />
              </th>
              <th className="px-3 py-2.5 font-semibold">Kod</th>
              <th className="px-3 py-2.5 font-semibold">Mijoz</th>
              <th className="px-3 py-2.5 font-semibold">Status</th>
              <th className="px-3 py-2.5 font-semibold">Reys</th>
              <th className="px-3 py-2.5 text-right font-semibold">Og&apos;irlik</th>
              <th className="px-3 py-2.5 text-right font-semibold">Narx</th>
              <th className="px-3 py-2.5 text-right font-semibold">Sana</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const checked = selected.has(r.id);
              return (
                <tr
                  key={r.id}
                  className={cn(
                    'border-b border-[#eef0f4] last:border-0',
                    checked ? 'bg-[#f3f5fb]' : 'hover:bg-secondary/60',
                  )}
                >
                  <td className="px-4 py-2.5 align-middle">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggle(r.id)}
                      aria-label={`${r.code} ni tanlash`}
                    />
                  </td>
                  <td className="px-3 py-2.5 align-middle">
                    <Link
                      href={`/tracks/${r.id}`}
                      className="font-mono font-semibold text-foreground underline-offset-2 hover:underline"
                    >
                      {r.code}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 align-middle text-slate-700">
                    {r.customerLabel ?? (
                      <span className="text-slate-400">Biriktirilmagan</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-middle">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-3 py-2.5 align-middle text-slate-700">
                    {r.batchName ?? <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right align-middle font-mono text-slate-700">
                    {r.weightText}
                  </td>
                  <td className="px-3 py-2.5 text-right align-middle font-mono text-slate-700">
                    {r.priceText}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right align-middle font-mono text-muted-foreground">
                    {r.dateText}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <StatusChangeDialog
        targets={targets}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onDone={() => setSelected(new Set())}
      />

      <BatchAssignDialog
        trackIds={[...selected]}
        batches={batches}
        open={batchOpen}
        onOpenChange={setBatchOpen}
        onDone={() => setSelected(new Set())}
      />
    </div>
  );
}

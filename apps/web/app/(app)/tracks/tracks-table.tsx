'use client';

import Link from 'next/link';
import { useState } from 'react';

import { StatusBadge } from '@/components/status-badge';
import type { TrackStatus } from '@kargotrack/shared';

export interface TrackRowView {
  id: string;
  code: string;
  status: TrackStatus;
  customerLabel: string | null;
  weightText: string;
  priceText: string;
  dateText: string;
}

/**
 * Tracks table with bulk-select checkboxes (SPEC §5.2). Selection is UI-only for
 * now — the "Status o'zgartirish" bulk action arrives in the next task.
 */
export function TracksTable({ rows }: { rows: TrackRowView[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allSelected = rows.length > 0 && selected.size === rows.length;

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
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Trek topilmadi.
      </div>
    );
  }

  return (
    <div className="relative">
      {selected.size > 0 ? (
        <div className="sticky top-[104px] z-[5] mb-2 flex items-center justify-between rounded-xl border border-slate-300 bg-slate-900 px-3 py-2 text-white shadow-sm">
          <span className="text-sm font-medium">
            {selected.size} ta trek tanlandi
          </span>
          <button
            type="button"
            disabled
            title="Keyingi bosqichda qo'shiladi"
            className="cursor-not-allowed rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold text-white/80"
          >
            Status o'zgartirish
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  aria-label="Barchasini tanlash"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-4 w-4 accent-slate-900"
                />
              </th>
              <th className="px-3 py-2 font-medium">Kod</th>
              <th className="px-3 py-2 font-medium">Mijoz</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 text-right font-medium">Og'irlik</th>
              <th className="px-3 py-2 text-right font-medium">Narx</th>
              <th className="px-3 py-2 text-right font-medium">Sana</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const checked = selected.has(r.id);
              return (
                <tr
                  key={r.id}
                  className={`border-b border-slate-100 last:border-0 ${
                    checked ? 'bg-slate-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="px-3 py-2 align-middle">
                    <input
                      type="checkbox"
                      aria-label={`${r.code} ni tanlash`}
                      checked={checked}
                      onChange={() => toggle(r.id)}
                      className="h-4 w-4 accent-slate-900"
                    />
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <Link
                      href={`/tracks/${r.id}`}
                      className="font-mono font-medium text-slate-900 underline-offset-2 hover:underline"
                    >
                      {r.code}
                    </Link>
                  </td>
                  <td className="px-3 py-2 align-middle text-slate-700">
                    {r.customerLabel ?? (
                      <span className="text-slate-400">Biriktirilmagan</span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-3 py-2 text-right align-middle tabular-nums text-slate-700">
                    {r.weightText}
                  </td>
                  <td className="px-3 py-2 text-right align-middle tabular-nums text-slate-700">
                    {r.priceText}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right align-middle text-slate-500">
                    {r.dateText}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

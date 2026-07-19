'use client';

import { useRouter } from 'next/navigation';

export interface BatchFilterOption {
  id: string;
  name: string;
}

/**
 * Reys filter dropdown (SPEC §5.2). Navigates on change, preserving the current
 * search term + status filter.
 */
export function BatchFilter({
  batches,
  current,
  q,
  status,
}: {
  batches: BatchFilterOption[];
  current: string | undefined;
  q: string;
  status: string | undefined;
}) {
  const router = useRouter();

  function onChange(value: string) {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    if (value) params.set('batch', value);
    const qs = params.toString();
    router.push(qs ? `/tracks?${qs}` : '/tracks');
  }

  return (
    <select
      value={current ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 flex-none rounded-lg border border-input bg-white px-2.5 text-sm text-slate-700 outline-none focus:border-primary"
      aria-label="Reys bo'yicha filtr"
    >
      <option value="">Barcha reyslar</option>
      {batches.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </select>
  );
}

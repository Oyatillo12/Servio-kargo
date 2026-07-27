'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';

export interface BatchFilterOption {
  id: string;
  name: string;
}

/**
 * Batch filter dropdown (SPEC §5.2). Navigates on change, preserving the search
 * term and whichever of status / worklist is currently narrowing the list.
 *
 * Deliberately a native `<select>` rather than the styled Radix one: a tenant
 * with forty batches renders a forty-item popover on a phone, where the OS
 * picker scrolls better, supports type-ahead, and never gets clipped by the
 * sticky header.
 */
export function BatchFilter({
  batches,
  current,
  q,
  status,
  work,
}: {
  batches: BatchFilterOption[];
  current: string | undefined;
  q: string;
  status: string | undefined;
  work: string | undefined;
}) {
  const t = useTranslations('tracks');
  const router = useRouter();
  const [, startTransition] = useTransition();

  function onChange(value: string) {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    if (work) params.set('work', work);
    if (value) params.set('batch', value);
    const qs = params.toString();
    startTransition(() => router.push(qs ? `/tracks?${qs}` : '/tracks'));
  }

  return (
    <select
      value={current ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 flex-none rounded-lg border border-input bg-white px-2.5 text-sm text-slate-700 outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
      aria-label={t('batchFilterLabel')}
    >
      <option value="">{t('allBatches')}</option>
      {batches.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </select>
  );
}

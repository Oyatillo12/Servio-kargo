import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { requireCapability } from '@/lib/auth';
import { listBatches } from '@/lib/queries';
import { NewBatchForm } from '@/features/batches/components/new-batch-form';
import { TRANSPORT_KEY } from '@/features/batches/transport';

export async function generateMetadata() {
  const t = await getTranslations('batches');
  return { title: `${t('pageTitle')} — SERVIO Kargo` };
}

export default async function BatchesPage() {
  const { tenant } = await requireCapability('batches.manage');
  const t = await getTranslations('batches');

  const batches = await listBatches(tenant.id);

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <PageHeader
        title={t('pageTitle')}
        count={batches.length}
        className="mb-0"
      />

      <NewBatchForm />

      {batches.length === 0 ? (
        <EmptyState title={t('emptyTitle')} hint={t('emptyHint')} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          {batches.map((b) => (
            <Link
              key={b.id}
              href={`/batches/${b.id}`}
              className="flex items-center gap-3 border-b border-[#eef0f4] px-4 py-3 transition-colors last:border-0 hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold text-foreground">
                    {b.name}
                  </span>
                  <StatusBadge status={b.status} />
                </div>
                <p className="mt-0.5 font-mono text-[12px] text-muted-foreground">
                  {t(TRANSPORT_KEY[b.transport])}
                  {b.etaDate ? ` · ${t('etaPrefix', { date: b.etaDate })}` : ''} ·{' '}
                  {t('trackCount', { count: b.trackCount })}
                </p>
              </div>
              <ChevronRight
                className="h-4 w-4 flex-none text-muted-foreground"
                aria-hidden
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

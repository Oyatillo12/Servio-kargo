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
    <div>
      <PageHeader title={t('pageTitle')} count={batches.length} />

      {/* On a phone the form comes first and the list follows it — creating a
          batch is what brings someone here, and there are rarely more than a
          dozen. A desk browser puts the form in a side column instead, so the
          list it feeds is visible while it is being filled in. */}
      <div className="md:grid md:grid-cols-3 md:items-start md:gap-5">
        <div className="mb-3 md:order-2 md:mb-0">
          <NewBatchForm />
        </div>

        <div className="md:order-1 md:col-span-2">
          {batches.length === 0 ? (
            <EmptyState title={t('emptyTitle')} hint={t('emptyHint')} />
          ) : (
            <div className="-mx-4 border-y border-rule bg-surface md:mx-0 md:rounded-lg md:border">
              {batches.map((b) => (
                <Link
                  key={b.id}
                  href={`/batches/${b.id}`}
                  className="flex items-center gap-3 border-b border-rule-soft px-4 py-3 transition-colors last:border-0 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold text-foreground">
                        {b.name}
                      </span>
                      <StatusBadge status={b.status} />
                    </div>
                    <p className="mt-0.5 font-mono text-micro text-faint">
                      {t(TRANSPORT_KEY[b.transport])}
                      {b.etaDate
                        ? ` · ${t('etaPrefix', { date: b.etaDate })}`
                        : ''}{' '}
                      · {t('trackCount', { count: b.trackCount })}
                    </p>
                  </div>
                  <ChevronRight
                    className="h-4 w-4 flex-none text-faint"
                    aria-hidden
                  />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

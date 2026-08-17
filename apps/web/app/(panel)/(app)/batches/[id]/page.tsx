import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { isBatchStatus } from '@kargotrack/shared';

import { StatusBadge } from '@/components/shared/status-badge';
import { DetailShell } from '@/components/layout/detail-shell';
import { resolveTab, type TabItem } from '@/components/ui/tabs';
import { requireCapability } from '@/lib/auth';
import { getBatchDetail } from '@/lib/queries';
import {
  BatchControls,
  type MemberInfo,
} from '@/features/batches/components/batch-controls';
import { TRANSPORT_KEY } from '@/features/batches/transport';

export async function generateMetadata() {
  const t = await getTranslations('batches');
  return { title: `${t('detailTitle')} — SERVIO Kargo` };
}

export default async function BatchDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string };
}) {
  const { tenant } = await requireCapability('batches.manage');
  const t = await getTranslations('batches');
  const tCommon = await getTranslations('common');

  const detail = await getBatchDetail(tenant.id, params.id);
  if (!detail) notFound();

  const { batch, members } = detail;
  // The batch's own status is always one of the three batch statuses; guard for
  // the type and fall back to CHINA_WAREHOUSE if somehow corrupted.
  const batchStatus = isBatchStatus(batch.status)
    ? batch.status
    : 'CHINA_WAREHOUSE';

  const memberInfo: MemberInfo[] = members.map((m) => ({
    id: m.id,
    currentStatus: m.currentStatus,
    customerId: m.customerId,
  }));

  const tabs: TabItem[] = [
    { key: 'umumiy', label: t('tabGeneral') },
    { key: 'tracks', label: t('tabTracks'), count: members.length },
  ];
  const tab = resolveTab(tabs, searchParams.tab);
  const tabHref = (key: string) =>
    key === 'umumiy' ? `/batches/${batch.id}` : `/batches/${batch.id}?tab=${key}`;

  return (
    <DetailShell
      backHref="/batches"
      backLabel={t('pageTitle')}
      eyebrow={t('eyebrow')}
      title={batch.name}
      status={<StatusBadge status={batch.status} />}
      tabs={tabs}
      activeTab={tab}
      buildTabHref={tabHref}
    >
      {tab === 'umumiy' ? (
        <div className="mx-auto max-w-2xl space-y-3">
          <p className="font-mono text-micro text-faint">
            {t(TRANSPORT_KEY[batch.transport])}
            {batch.etaDate
              ? ` · ${t('etaPrefix', { date: batch.etaDate })}`
              : ''}{' '}
            · {t('trackCount', { count: members.length })}
          </p>

          <BatchControls
            batchId={batch.id}
            initialStatus={batchStatus}
            initialEta={batch.etaDate ?? ''}
            members={memberInfo}
          />
        </div>
      ) : null}

      {tab === 'tracks' ? (
        <div className="-mx-4 border-y border-rule bg-surface md:mx-0 md:rounded-lg md:border">
          {members.length === 0 ? (
            <p className="px-4 py-6 text-center text-small text-muted-foreground">
              {t('noMembers')}
            </p>
          ) : (
            members.map((m) => (
              <Link
                key={m.id}
                href={`/tracks/${m.id}`}
                className="flex items-center justify-between gap-2 border-b border-rule-soft px-4 py-3 transition-colors last:border-0 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-small font-semibold text-foreground">
                    {m.codeOriginal}
                  </p>
                  <p className="truncate text-micro text-faint">
                    {m.customerLabel ?? (
                      <span className="text-faint">{tCommon('unassigned')}</span>
                    )}
                  </p>
                </div>
                <StatusBadge status={m.currentStatus} />
              </Link>
            ))
          )}
        </div>
      ) : null}
    </DetailShell>
  );
}

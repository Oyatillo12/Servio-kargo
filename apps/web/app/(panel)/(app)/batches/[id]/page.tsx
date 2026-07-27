import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { isBatchStatus } from '@kargotrack/shared';

import { StatusBadge } from '@/components/shared/status-badge';
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
}: {
  params: { id: string };
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

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <Link
        href="/batches"
        className="inline-flex items-center gap-1.5 rounded text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t('pageTitle')}
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-foreground">{batch.name}</h1>
        <StatusBadge status={batch.status} />
      </div>
      <p className="font-mono text-[12.5px] text-muted-foreground">
        {t(TRANSPORT_KEY[batch.transport])}
        {batch.etaDate ? ` · ${t('etaPrefix', { date: batch.etaDate })}` : ''} ·{' '}
        {t('trackCount', { count: members.length })}
      </p>

      <BatchControls
        batchId={batch.id}
        initialStatus={batchStatus}
        initialEta={batch.etaDate ?? ''}
        members={memberInfo}
      />

      {/* Member tracks */}
      <div className="overflow-hidden rounded-xl border border-border bg-white">
        <div className="border-b border-border bg-secondary px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t('membersTitle')}
        </div>
        {members.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            {t('noMembers')}
          </p>
        ) : (
          members.map((m) => (
            <Link
              key={m.id}
              href={`/tracks/${m.id}`}
              className="flex items-center justify-between gap-2 border-b border-[#eef0f4] px-4 py-3 transition-colors last:border-0 hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <div className="min-w-0">
                <p className="truncate font-mono text-[13.5px] font-semibold text-foreground">
                  {m.codeOriginal}
                </p>
                <p className="truncate text-[12px] text-muted-foreground">
                  {m.customerLabel ?? (
                    <span className="text-slate-400">
                      {tCommon('unassigned')}
                    </span>
                  )}
                </p>
              </div>
              <StatusBadge status={m.currentStatus} />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

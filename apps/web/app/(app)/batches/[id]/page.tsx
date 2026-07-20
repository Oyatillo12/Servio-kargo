import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import type { Transport } from '@kargotrack/db/schema';
import { isBatchStatus } from '@kargotrack/shared';

import { StatusBadge } from '@/components/status-badge';
import { requireAdmin } from '@/lib/auth';
import { getBatchDetail } from '@/lib/queries';

import { BatchControls, type MemberInfo } from './batch-controls';

export const metadata = { title: 'Reys — SERVIO Kargo' };

const TRANSPORT_LABEL: Record<Transport, string> = {
  avia: 'Avia',
  avto: 'Avto',
  train: 'Poyezd',
};

export default async function BatchDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { tenant } = await requireAdmin();
  const detail = await getBatchDetail(tenant.id, params.id);
  if (!detail) notFound();

  const { batch, members } = detail;
  // The batch's own status is always one of the three batch statuses; guard for
  // the type and fall back to CHINA_WAREHOUSE if somehow corrupted.
  const batchStatus = isBatchStatus(batch.status) ? batch.status : 'CHINA_WAREHOUSE';

  const memberInfo: MemberInfo[] = members.map((m) => ({
    id: m.id,
    currentStatus: m.currentStatus,
    customerId: m.customerId,
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <Link
        href="/batches"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Reyslar
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-foreground">{batch.name}</h1>
        <StatusBadge status={batch.status} />
      </div>
      <p className="font-mono text-[12.5px] text-muted-foreground">
        {TRANSPORT_LABEL[batch.transport]}
        {batch.etaDate ? ` · ETA ${batch.etaDate}` : ''} · {members.length} ta trek
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
          Treklar
        </div>
        {members.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            Bu reysda trek yo&apos;q.
          </p>
        ) : (
          members.map((m) => (
            <Link
              key={m.id}
              href={`/tracks/${m.id}`}
              className="flex items-center justify-between gap-2 border-b border-[#eef0f4] px-4 py-3 last:border-0 hover:bg-secondary/50"
            >
              <div className="min-w-0">
                <p className="truncate font-mono text-[13.5px] font-semibold text-foreground">
                  {m.codeOriginal}
                </p>
                <p className="truncate text-[12px] text-muted-foreground">
                  {m.customerLabel ?? (
                    <span className="text-slate-400">Biriktirilmagan</span>
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

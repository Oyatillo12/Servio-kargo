import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import type { Transport } from '@kargotrack/db/schema';

import { StatusBadge } from '@/components/status-badge';
import { requireAdmin } from '@/lib/auth';
import { listBatches } from '@/lib/queries';

import { NewBatchForm } from './new-batch-form';

export const metadata = { title: 'Reyslar — KargoTrack' };

const TRANSPORT_LABEL: Record<Transport, string> = {
  avia: 'Avia',
  avto: 'Avto',
  train: 'Poyezd',
};

export default async function BatchesPage() {
  const { tenant } = await requireAdmin();
  const batches = await listBatches(tenant.id);

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold text-foreground">Reyslar</h1>
        <span className="text-xs text-muted-foreground">
          jami <span className="font-mono font-semibold">{batches.length}</span>
        </span>
      </div>

      <NewBatchForm />

      {batches.length === 0 ? (
        <div className="rounded-xl border border-border bg-white p-10 text-center">
          <p className="text-sm font-semibold text-foreground">Reys yo&apos;q</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Yuqoridagi tugma orqali birinchi reysni yarating.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          {batches.map((b) => (
            <Link
              key={b.id}
              href={`/batches/${b.id}`}
              className="flex items-center gap-3 border-b border-[#eef0f4] px-4 py-3 last:border-0 hover:bg-secondary/50"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold text-foreground">
                    {b.name}
                  </span>
                  <StatusBadge status={b.status} />
                </div>
                <p className="mt-0.5 font-mono text-[12px] text-muted-foreground">
                  {TRANSPORT_LABEL[b.transport]}
                  {b.etaDate ? ` · ETA ${b.etaDate}` : ''} · {b.trackCount} ta trek
                </p>
              </div>
              <ChevronRight className="h-4 w-4 flex-none text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

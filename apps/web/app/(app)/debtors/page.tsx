import Link from 'next/link';

import { formatSom } from '@kargotrack/shared';

import { DebtCell } from '@/components/debt-cell';
import { EmptyState } from '@/components/empty-state';
import { ExportButton } from '@/components/export-button';
import { PageHeader } from '@/components/page-header';
import { ReminderButton } from '@/components/reminder-button';
import { requireAdmin } from '@/lib/auth';
import { listDebtors } from '@/lib/queries';
import { sendReminderAction } from '@/lib/reminder-actions';

import { BulkReminder } from './bulk-reminder';

export const metadata = { title: 'Qarzdorlar — SERVIO Kargo' };

export default async function DebtorsPage() {
  const { tenant } = await requireAdmin();
  const debtors = await listDebtors(tenant.id);

  const totalTiyin = debtors.reduce((sum, c) => sum + c.debtTiyin, 0);

  return (
    <div>
      <PageHeader
        title="Qarzdorlar"
        right={
          <div className="flex items-center gap-2">
            <span className="mr-1 text-xs text-muted-foreground">
              jami{' '}
              <span className="font-mono font-semibold text-[#b3261e]">
                {debtors.length} · {formatSom(totalTiyin)} so&apos;m
              </span>
            </span>
            <ExportButton href="/api/export/customers?debtors=1" />
          </div>
        }
      />

      {debtors.length > 0 ? (
        <div className="mb-4">
          <BulkReminder
            count={debtors.length}
            totalDebtText={`${formatSom(totalTiyin)} so'm`}
          />
        </div>
      ) : null}

      {debtors.length === 0 ? (
        <EmptyState
          icon={
            <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full border border-[#c2e8cf] bg-[#e2f6e8] text-lg text-[#177338]">
              ✓
            </div>
          }
          title="Qarzdorlar yo'q"
          hint="Barcha to'lovlar yopilgan."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          {debtors.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 border-b border-[#eef0f4] px-4 py-3 last:border-0"
            >
              <Link href={`/customers/${c.id}`} className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {c.fullName ?? 'Ismi yo‘q'}{' '}
                  <span className="font-mono text-[12px] font-medium text-muted-foreground">
                    {c.clientCode}
                  </span>
                </p>
                <p className="text-[12px] text-muted-foreground">
                  {c.trackCount} ta trek
                </p>
              </Link>
              <div className="flex flex-none items-center gap-2.5">
                <DebtCell tiyin={c.debtTiyin} />
                <ReminderButton
                  action={sendReminderAction.bind(null, c.id)}
                  size="sm"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

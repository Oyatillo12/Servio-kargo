import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { formatSom } from '@kargotrack/shared';

import { DebtCell } from '@/components/shared/debt-cell';
import { EmptyState } from '@/components/shared/empty-state';
import { ExportButton } from '@/components/shared/export-button';
import { ReminderButton } from '@/components/shared/reminder-button';
import { PageHeader } from '@/components/layout/page-header';
import { requireAdmin } from '@/lib/auth';
import { listDebtors } from '@/lib/queries';
import { sendReminderAction } from '@/features/debtors/actions';
import { BulkReminder } from '@/features/debtors/components/bulk-reminder';

export async function generateMetadata() {
  const t = await getTranslations('debtors');
  return { title: `${t('pageTitle')} — SERVIO Kargo` };
}

export default async function DebtorsPage() {
  const { tenant } = await requireAdmin();
  const t = await getTranslations('debtors');
  const tCommon = await getTranslations('common');

  const debtors = await listDebtors(tenant.id);
  const totalTiyin = debtors.reduce((sum, c) => sum + c.debtTiyin, 0);

  return (
    <div>
      {/* The total used to sit in the header's right slot next to the Excel
          button, which overflowed the viewport on phones and squeezed the
          figure into an unreadable strip. It gets its own full-width card. */}
      <PageHeader
        title={t('pageTitle')}
        right={<ExportButton href="/api/export/customers?debtors=1" />}
      />

      {debtors.length > 0 ? (
        <div className="mb-4 rounded-xl border border-[#f3d6d4] bg-[#fdf6f6] p-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[12px] text-muted-foreground">
              {t('totalDebt')}
            </span>
            <span className="text-[12px] text-muted-foreground">
              {t('debtorCount', { count: debtors.length })}
            </span>
          </div>
          <p className="mt-1 whitespace-nowrap font-mono text-[22px] font-bold leading-tight tabular-nums text-[#b3261e]">
            {formatSom(totalTiyin)}
            <span className="ml-1 text-[12px] font-medium text-muted-foreground">
              {tCommon('som')}
            </span>
          </p>
          <div className="mt-3">
            <BulkReminder
              count={debtors.length}
              totalDebtText={`${formatSom(totalTiyin)} ${tCommon('som')}`}
            />
          </div>
        </div>
      ) : null}

      {debtors.length === 0 ? (
        <EmptyState
          icon={
            <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full border border-[#c2e8cf] bg-[#e2f6e8] text-lg text-[#177338]">
              ✓
            </div>
          }
          title={t('emptyTitle')}
          hint={t('emptyHint')}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          {debtors.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 border-b border-[#eef0f4] px-4 py-3 last:border-0"
            >
              <Link
                href={`/customers/${c.id}`}
                className="min-w-0 flex-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <p className="truncate text-sm font-semibold text-foreground">
                  {c.fullName ?? tCommon('noName')}{' '}
                  <span className="font-mono text-[12px] font-medium text-muted-foreground">
                    {c.clientCode}
                  </span>
                </p>
                <p className="text-[12px] text-muted-foreground">
                  {t('trackCount', { count: c.trackCount })}
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

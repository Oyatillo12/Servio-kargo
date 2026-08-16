import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { formatSom } from '@kargotrack/shared';

import { DebtCell } from '@/components/shared/debt-cell';
import { EmptyState } from '@/components/shared/empty-state';
import { ExportButton } from '@/components/shared/export-button';
import { Pagination } from '@/components/shared/pagination';
import { ReminderButton } from '@/components/shared/reminder-button';
import { PageHeader } from '@/components/layout/page-header';
import { requireCapability } from '@/lib/auth';
import {
  CUSTOMERS_PAGE_SIZE,
  getDebtTotals,
  listCustomersWithDebt,
} from '@/lib/queries';
import { sendReminderAction } from '@/features/debtors/actions';
import { BulkReminder } from '@/features/debtors/components/bulk-reminder';

export async function generateMetadata() {
  const t = await getTranslations('debtors');
  return { title: `${t('pageTitle')} — SERVIO Kargo` };
}

export default async function DebtorsPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const { tenant } = await requireCapability('money.reports');
  const t = await getTranslations('debtors');
  const tCommon = await getTranslations('common');

  const requestedPage = Math.max(1, Number(searchParams.page) || 1);

  // The summary card and "remind all" stay whole-tenant while the list is
  // paged: an owner reads the total debt as the number for the business, and a
  // figure that shrank because they turned to page 2 would be worse than no
  // figure at all. `getDebtTotals` is one aggregate (AUDIT.md T6).
  const [{ debtorCount, debtTiyin: totalTiyin }, { rows: debtors }] =
    await Promise.all([
      getDebtTotals(tenant.id),
      listCustomersWithDebt({
        tenantId: tenant.id,
        onlyDebtors: true,
        sort: 'debt',
        limit: CUSTOMERS_PAGE_SIZE,
        offset: (requestedPage - 1) * CUSTOMERS_PAGE_SIZE,
      }),
    ]);

  const pages = Math.max(1, Math.ceil(debtorCount / CUSTOMERS_PAGE_SIZE));
  const page = Math.min(requestedPage, pages);
  const pageHref = (target: number) =>
    target > 1 ? `/debtors?page=${target}` : '/debtors';

  return (
    <div>
      {/* The total used to sit in the header's right slot next to the Excel
          button, which overflowed the viewport on phones and squeezed the
          figure into an unreadable strip. It gets its own full-width card. */}
      <PageHeader
        title={t('pageTitle')}
        right={<ExportButton href="/api/export/customers?debtors=1" />}
      />

      {debtorCount > 0 ? (
        <div className="mb-4 rounded-lg border border-destructive/25 bg-[var(--st-lost-bg)] p-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-micro text-muted-foreground">
              {t('totalDebt')}
            </span>
            <span className="text-micro text-muted-foreground">
              {t('debtorCount', { count: debtorCount })}
            </span>
          </div>
          <p className="mt-1 whitespace-nowrap font-mono text-title font-bold leading-tight tabular-nums text-destructive">
            {formatSom(totalTiyin)}
            <span className="ml-1 text-micro font-medium text-muted-foreground">
              {tCommon('som')}
            </span>
          </p>
          <div className="mt-3">
            <BulkReminder
              count={debtorCount}
              totalDebtText={`${formatSom(totalTiyin)} ${tCommon('som')}`}
            />
          </div>
        </div>
      ) : null}

      {debtorCount === 0 ? (
        <EmptyState
          icon={
            <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full border border-success/25 bg-[var(--st-ready-bg)] text-lg text-success">
              ✓
            </div>
          }
          title={t('emptyTitle')}
          hint={t('emptyHint')}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          {debtors.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 border-b border-rule-soft px-4 py-3 last:border-0"
            >
              <Link
                href={`/customers/${c.id}`}
                className="min-w-0 flex-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <p className="truncate text-sm font-semibold text-foreground">
                  {c.fullName ?? tCommon('noName')}{' '}
                  <span className="font-mono text-micro font-medium text-muted-foreground">
                    {c.clientCode}
                  </span>
                </p>
                <p className="text-micro text-muted-foreground">
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

      <Pagination page={page} pages={pages} buildHref={pageHref} />
    </div>
  );
}

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { can } from '@kargotrack/shared';

import { DebtCell } from '@/components/shared/debt-cell';
import { EmptyState } from '@/components/shared/empty-state';
import { ExportButton } from '@/components/shared/export-button';
import { SearchField } from '@/components/shared/search-field';
import { PageHeader } from '@/components/layout/page-header';
import { requireCapability } from '@/lib/auth';
import { listCustomersWithDebt } from '@/lib/queries';
import { NewCustomerButton } from '@/features/customers/components/new-customer-button';

export async function generateMetadata() {
  const t = await getTranslations('customers');
  return { title: `${t('pageTitle')} — SERVIO Kargo` };
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const { tenant, role } = await requireCapability('customers.view');
  const t = await getTranslations('customers');
  const tCommon = await getTranslations('common');

  const q = searchParams.q?.trim() ?? '';
  const customers = await listCustomersWithDebt(tenant.id, q);

  return (
    <div>
      <PageHeader
        title={t('pageTitle')}
        count={customers.length}
        right={
          <>
            {can(role, 'export.data') ? (
              <ExportButton
                href={`/api/export/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`}
              />
            ) : null}
            {can(role, 'customers.manage') ? <NewCustomerButton /> : null}
          </>
        }
      />

      <div className="mb-4 flex">
        <SearchField
          path="/customers"
          value={q}
          placeholder={t('searchPlaceholder')}
          label={t('searchPlaceholder')}
        />
      </div>

      {customers.length === 0 ? (
        <EmptyState
          title={t('emptyTitle')}
          hint={q ? t('emptyHintSearch') : t('emptyHint')}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          {customers.map((c) => (
            <Link
              key={c.id}
              href={`/customers/${c.id}`}
              className="flex items-center justify-between gap-3 border-b border-[#eef0f4] px-4 py-3 transition-colors last:border-0 hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {c.fullName ?? tCommon('noName')}{' '}
                  <span className="font-mono text-[12px] font-medium text-muted-foreground">
                    {c.clientCode}
                  </span>
                </p>
                <p className="truncate font-mono text-[12px] text-muted-foreground">
                  {c.phone ?? tCommon('dash')}
                </p>
              </div>
              <div className="flex-none text-right">
                <p className="text-[12px] text-muted-foreground">
                  {t('trackCount', { count: c.trackCount })}
                </p>
                <p className="text-[12.5px]">
                  <DebtCell tiyin={c.debtTiyin} />
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

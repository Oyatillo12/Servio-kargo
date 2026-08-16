import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { can } from '@kargotrack/shared';

import { DebtCell } from '@/components/shared/debt-cell';
import { EmptyState } from '@/components/shared/empty-state';
import { ExportButton } from '@/components/shared/export-button';
import { Pagination } from '@/components/shared/pagination';
import { SearchField } from '@/components/shared/search-field';
import { PageHeader } from '@/components/layout/page-header';
import { requireCapability } from '@/lib/auth';
import { CUSTOMERS_PAGE_SIZE, listCustomersWithDebt } from '@/lib/queries';
import { NewCustomerButton } from '@/features/customers/components/new-customer-button';

export async function generateMetadata() {
  const t = await getTranslations('customers');
  return { title: `${t('pageTitle')} — SERVIO Kargo` };
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string; blocked?: string };
}) {
  const { tenant, role } = await requireCapability('customers.view');
  const t = await getTranslations('customers');
  const tCommon = await getTranslations('common');

  const q = searchParams.q?.trim() ?? '';
  // §7.17 (K3): the blocked filter is a URL flag like the search, so a
  // dashboard card can link straight into it and the view survives a reload.
  const onlyBlocked = searchParams.blocked === '1';
  const requestedPage = Math.max(1, Number(searchParams.page) || 1);

  const { rows: customers, total } = await listCustomersWithDebt({
    tenantId: tenant.id,
    q,
    onlyBlocked,
    sort: 'code',
    limit: CUSTOMERS_PAGE_SIZE,
    offset: (requestedPage - 1) * CUSTOMERS_PAGE_SIZE,
  });

  const pages = Math.max(1, Math.ceil(total / CUSTOMERS_PAGE_SIZE));
  const page = Math.min(requestedPage, pages);

  // Search and page travel together: dropping `q` on a page change would swap
  // the list under the admin without any visible reason.
  const pageHref = (target: number) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (onlyBlocked) params.set('blocked', '1');
    if (target > 1) params.set('page', String(target));
    const qs = params.toString();
    return qs ? `/customers?${qs}` : '/customers';
  };

  // Toggling the filter drops the page: page 4 of "everyone" is rarely page 4
  // of "blocked", and landing on an empty page reads as "nobody is blocked".
  const filterHref = (blocked: boolean) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (blocked) params.set('blocked', '1');
    const qs = params.toString();
    return qs ? `/customers?${qs}` : '/customers';
  };

  return (
    <div>
      <PageHeader
        title={t('pageTitle')}
        count={total}
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

      <div className="mb-3 flex">
        <SearchField
          path="/customers"
          value={q}
          placeholder={t('searchPlaceholder')}
          label={t('searchPlaceholder')}
        />
      </div>

      <div className="mb-4 flex gap-2">
        <Link
          href={filterHref(false)}
          aria-current={onlyBlocked ? undefined : 'page'}
          className={
            onlyBlocked
              ? 'rounded-full border border-input px-3 py-1.5 text-micro font-medium text-muted-foreground transition-colors hover:bg-secondary'
              : 'rounded-full bg-primary px-3 py-1.5 text-micro font-semibold text-primary-foreground'
          }
        >
          {t('filterAll')}
        </Link>
        <Link
          href={filterHref(true)}
          aria-current={onlyBlocked ? 'page' : undefined}
          className={
            onlyBlocked
              ? 'rounded-full bg-primary px-3 py-1.5 text-micro font-semibold text-primary-foreground'
              : 'rounded-full border border-input px-3 py-1.5 text-micro font-medium text-muted-foreground transition-colors hover:bg-secondary'
          }
        >
          🚫 {t('filterBlocked')}
        </Link>
      </div>

      {customers.length === 0 ? (
        <EmptyState
          title={onlyBlocked ? t('emptyBlockedTitle') : t('emptyTitle')}
          hint={
            onlyBlocked
              ? t('emptyBlockedHint')
              : q
                ? t('emptyHintSearch')
                : t('emptyHint')
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          {customers.map((c) => (
            <Link
              key={c.id}
              href={`/customers/${c.id}`}
              className="flex items-center justify-between gap-3 border-b border-rule-soft px-4 py-3 transition-colors last:border-0 hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {c.botBlocked ? (
                    <span title={t('blockedBadge')} aria-label={t('blockedBadge')}>
                      🚫{' '}
                    </span>
                  ) : null}
                  {c.fullName ?? tCommon('noName')}{' '}
                  <span className="font-mono text-micro font-medium text-muted-foreground">
                    {c.clientCode}
                  </span>
                </p>
                <p className="truncate font-mono text-micro text-muted-foreground">
                  {c.phone ?? tCommon('dash')}
                </p>
              </div>
              <div className="flex-none text-right">
                <p className="text-micro text-muted-foreground">
                  {t('trackCount', { count: c.trackCount })}
                </p>
                <p className="text-micro">
                  <DebtCell tiyin={c.debtTiyin} />
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Pagination page={page} pages={pages} buildHref={pageHref} />
    </div>
  );
}

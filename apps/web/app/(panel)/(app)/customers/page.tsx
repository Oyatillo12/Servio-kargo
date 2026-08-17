import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { can } from '@kargotrack/shared';

import { DebtCell } from '@/components/shared/debt-cell';
import { EmptyState } from '@/components/shared/empty-state';
import { ExportButton } from '@/components/shared/export-button';
import { FilterChips } from '@/components/shared/filter-chips';
import { Pagination } from '@/components/shared/pagination';
import { SearchField } from '@/components/shared/search-field';
import { PageHeader } from '@/components/layout/page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  tableHeadRowClass,
} from '@/components/ui/table';
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

      <FilterChips
        className="mb-4"
        label={t('filterLabel')}
        active={onlyBlocked ? '1' : undefined}
        buildHref={(v) => filterHref(v === '1')}
        chips={[
          { value: undefined, label: t('filterAll') },
          { value: '1', label: t('filterBlocked'), emoji: '🚫' },
        ]}
      />

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
        <>
          {/* Phone: one tappable row per customer, edge to edge. */}
          <div className="-mx-4 border-y border-rule bg-surface md:hidden">
            {customers.map((c) => (
              <Link
                key={c.id}
                href={`/customers/${c.id}`}
                className="flex items-center justify-between gap-3 border-b border-rule-soft px-4 py-3 transition-colors last:border-0 active:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-semibold text-foreground">
                    {c.botBlocked ? (
                      <span title={t('blockedBadge')} aria-label={t('blockedBadge')}>
                        🚫{' '}
                      </span>
                    ) : null}
                    {c.fullName ?? tCommon('noName')}{' '}
                    <span className="font-mono text-micro font-medium text-faint">
                      {c.clientCode}
                    </span>
                  </p>
                  <p className="truncate font-mono text-micro text-faint">
                    {c.phone ?? tCommon('dash')}
                  </p>
                </div>
                <div className="flex-none text-right">
                  <p className="text-micro text-faint">
                    {t('trackCount', { count: c.trackCount })}
                  </p>
                  <p className="text-small">
                    <DebtCell tiyin={c.debtTiyin} />
                  </p>
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop: the columns SPEC 5.5 names. The phone row folds five
              values into two lines because a thumb-width screen has no other
              option; a desk browser has the width, and a column of debts that
              can be scanned top to bottom is the whole point of the screen. */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <tr className={tableHeadRowClass}>
                  <TableHead>{t('colCode')}</TableHead>
                  <TableHead>{t('colName')}</TableHead>
                  <TableHead>{t('colPhone')}</TableHead>
                  <TableHead className="text-right">{t('colTracks')}</TableHead>
                  <TableHead className="text-right">{t('colDebt')}</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {customers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="px-4">
                      <Link
                        href={`/customers/${c.id}`}
                        className="font-mono font-semibold text-foreground underline-offset-2 hover:underline"
                      >
                        {c.clientCode}
                      </Link>
                    </TableCell>
                    <TableCell className="text-ink-2">
                      <Link
                        href={`/customers/${c.id}`}
                        className="underline-offset-2 hover:underline"
                      >
                        {c.botBlocked ? (
                          <span
                            title={t('blockedBadge')}
                            aria-label={t('blockedBadge')}
                          >
                            🚫{' '}
                          </span>
                        ) : null}
                        {c.fullName ?? tCommon('noName')}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-ink-2">
                      {c.phone ?? <span className="text-faint">{tCommon('dash')}</span>}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-ink-2">
                      {c.trackCount}
                    </TableCell>
                    <TableCell className="text-right">
                      <DebtCell tiyin={c.debtTiyin} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <Pagination page={page} pages={pages} buildHref={pageHref} />
    </div>
  );
}

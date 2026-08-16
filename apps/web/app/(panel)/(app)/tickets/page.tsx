import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { z } from 'zod';

import {
  TICKET_CATEGORY_META,
  TICKET_STATUS_META,
  formatDateTime,
  type Lang,
} from '@kargotrack/shared';

import { EmptyState } from '@/components/shared/empty-state';
import { FilterChips } from '@/components/shared/filter-chips';
import { Pagination } from '@/components/shared/pagination';
import { SectionCard } from '@/components/ui/section-card';
import { requireCapability } from '@/lib/auth';
import {
  listTickets,
  type TicketListFilter,
} from '@/lib/queries';

export async function generateMetadata() {
  const t = await getTranslations('tickets');
  return { title: `${t('pageTitle')} — SERVIO Kargo` };
}

const FILTERS = ['active', 'open', 'in_progress', 'closed', 'all'] as const;

const paramsSchema = z.object({
  f: z.enum(FILTERS).catch('active'),
  page: z.coerce.number().int().min(1).catch(1),
});

/**
 * The ticket desk's queue (SPEC §5.16, tasks.md H3). Default view = open +
 * in_progress — the work, not the archive.
 */
export default async function TicketsPage({
  searchParams,
}: {
  searchParams: { f?: string; page?: string };
}) {
  const { tenant } = await requireCapability('tickets.handle');
  const t = await getTranslations('tickets');
  const tCommon = await getTranslations('common');
  const locale = (await getLocale()) as Lang;

  const { f, page } = paramsSchema.parse(searchParams);
  const result = await listTickets(tenant.id, f as TicketListFilter, page);

  const buildHref = (filter: string | undefined, p = 1) => {
    const params = new URLSearchParams();
    if (filter && filter !== 'active') params.set('f', filter);
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    return qs ? `/tickets?${qs}` : '/tickets';
  };

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-title font-semibold text-foreground">
          {t('pageTitle')}
        </h1>
        <span className="font-mono text-sm text-muted-foreground">
          {result.total}
        </span>
      </div>

      <FilterChips
        label={t('filterLabel')}
        active={f === 'active' ? undefined : f}
        buildHref={(v) => buildHref(v)}
        chips={[
          { value: undefined, label: t('filter_active') },
          ...(['open', 'in_progress', 'closed'] as const).map((s) => ({
            value: s,
            label: TICKET_STATUS_META[s][locale],
            emoji: TICKET_STATUS_META[s].emoji,
          })),
          { value: 'all', label: t('filter_all') },
        ]}
      />

      {result.rows.length === 0 ? (
        <EmptyState title={t('empty')} />
      ) : (
        <SectionCard flush>
          <ul>
            {result.rows.map((row) => {
              const cat = TICKET_CATEGORY_META[row.category];
              const st = TICKET_STATUS_META[row.status];
              return (
                <li
                  key={row.id}
                  className="border-t border-rule-soft first:border-0"
                >
                  <Link
                    href={`/tickets/${row.id}`}
                    className="block px-4 py-3 transition-colors hover:bg-secondary/50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-small font-semibold text-foreground">
                        {cat.emoji} {cat[locale]}
                        {row.trackCode ? (
                          <span className="ml-2 font-mono text-micro font-normal text-muted-foreground">
                            {row.trackCode}
                          </span>
                        ) : null}
                      </span>
                      <span className="flex-none text-micro font-semibold">
                        {st.emoji} {st[locale]}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-small text-ink-2">
                      {row.lastMessageText || tCommon('dash')}
                    </p>
                    <div className="mt-1 flex items-center justify-between gap-3 text-micro text-muted-foreground">
                      <span className="min-w-0 truncate">
                        {row.clientCode}
                        {row.customerName ? ` · ${row.customerName}` : ''}
                        {row.assignedToName
                          ? ` · 👤 ${row.assignedToName}`
                          : ''}
                      </span>
                      <span className="flex-none font-mono">
                        {formatDateTime(row.lastMessageAt)}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      )}

      <Pagination
        page={result.page}
        pages={result.pages}
        buildHref={(p) => buildHref(f === 'active' ? undefined : f, p)}
      />
    </div>
  );
}

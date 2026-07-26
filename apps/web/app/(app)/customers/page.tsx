import Link from 'next/link';

import { DebtCell } from '@/components/debt-cell';
import { EmptyState } from '@/components/empty-state';
import { ExportButton } from '@/components/export-button';
import { PageHeader } from '@/components/page-header';
import { Input } from '@/components/ui/input';
import { requireAdmin } from '@/lib/auth';
import { listCustomersWithDebt } from '@/lib/queries';

import { NewCustomerButton } from './new-customer-button';

export const metadata = { title: 'Mijozlar — SERVIO Kargo' };

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const { tenant } = await requireAdmin();
  const q = searchParams.q?.trim() ?? '';
  const customers = await listCustomersWithDebt(tenant.id, q);

  return (
    <div>
      <PageHeader
        title="Mijozlar"
        right={
          <div className="flex items-center gap-2">
            <span className="mr-1 text-xs text-muted-foreground">
              jami{' '}
              <span className="font-mono font-semibold">{customers.length}</span>
            </span>
            <ExportButton
              href={`/api/export/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`}
            />
            <NewCustomerButton />
          </div>
        }
      />

      <form method="get" className="mb-4">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Ism, kod yoki telefon qidirish"
          className="bg-[#f7f8fa]"
        />
      </form>

      {customers.length === 0 ? (
        <EmptyState
          title="Mijoz topilmadi"
          hint={
            q
              ? "Qidiruvni o'zgartirib ko'ring."
              : "«Yangi mijoz» tugmasi bilan qo'shing — mijoz botga kirganda telefoni bo'yicha ulanadi."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          {customers.map((c) => (
            <Link
              key={c.id}
              href={`/customers/${c.id}`}
              className="flex items-center justify-between gap-3 border-b border-[#eef0f4] px-4 py-3 last:border-0 hover:bg-secondary/60"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {c.fullName ?? 'Ismi yo‘q'}{' '}
                  <span className="font-mono text-[12px] font-medium text-muted-foreground">
                    {c.clientCode}
                  </span>
                </p>
                <p className="truncate font-mono text-[12px] text-muted-foreground">
                  {c.phone ?? '—'}
                </p>
              </div>
              <div className="flex-none text-right">
                <p className="text-[12px] text-muted-foreground">
                  {c.trackCount} ta trek
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

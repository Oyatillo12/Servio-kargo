import Link from 'next/link';

import { DebtCell } from '@/components/debt-cell';
import { Input } from '@/components/ui/input';
import { requireAdmin } from '@/lib/auth';
import { listCustomersWithDebt } from '@/lib/queries';

export const metadata = { title: 'Mijozlar — KargoTrack' };

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
      <div className="mb-3 flex items-baseline justify-between">
        <h1 className="text-xl font-bold text-foreground">Mijozlar</h1>
        <span className="text-xs text-muted-foreground">
          jami <span className="font-mono font-semibold">{customers.length}</span>
        </span>
      </div>

      <form method="get" className="mb-4">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Ism, kod yoki telefon qidirish"
          className="bg-[#f7f8fa]"
        />
      </form>

      {customers.length === 0 ? (
        <div className="rounded-xl border border-border bg-white p-10 text-center">
          <div className="mx-auto mb-2 h-11 w-11 rounded-full border-2 border-dotted border-[#c3c9d6]" />
          <p className="text-sm font-semibold text-foreground">
            Mijoz topilmadi
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Qidiruvni o&apos;zgartirib ko&apos;ring.
          </p>
        </div>
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

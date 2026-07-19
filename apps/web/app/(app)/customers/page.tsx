import { DebtCell } from '@/components/debt-cell';
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
        <h1 className="text-lg font-bold text-slate-900">Mijozlar</h1>
        <span className="text-sm text-slate-500">{customers.length} ta</span>
      </div>

      <form method="get" className="mb-4 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Ism, telefon yoki kod bo'yicha qidirish"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
        />
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Qidirish
        </button>
      </form>

      {customers.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Mijoz topilmadi.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 font-medium">Kod</th>
                <th className="px-3 py-2 font-medium">Ism</th>
                <th className="px-3 py-2 font-medium">Telefon</th>
                <th className="px-3 py-2 text-right font-medium">Treklar</th>
                <th className="px-3 py-2 text-right font-medium">Qarz</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                >
                  <td className="whitespace-nowrap px-3 py-2 align-middle font-medium text-slate-800">
                    {c.clientCode}
                  </td>
                  <td className="px-3 py-2 align-middle text-slate-700">
                    {c.fullName ?? '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 align-middle text-slate-700">
                    {c.phone ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-right align-middle tabular-nums text-slate-700">
                    {c.trackCount}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right align-middle">
                    <DebtCell tiyin={c.debtTiyin} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

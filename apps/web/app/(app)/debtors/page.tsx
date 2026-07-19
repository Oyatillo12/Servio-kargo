import Link from 'next/link';

import { DebtCell } from '@/components/debt-cell';
import { ReminderButton } from '@/components/reminder-button';
import { requireAdmin } from '@/lib/auth';
import { listDebtors } from '@/lib/queries';
import {
  sendAllRemindersAction,
  sendReminderAction,
} from '@/lib/reminder-actions';

export const metadata = { title: 'Qarzdorlar — KargoTrack' };

export default async function DebtorsPage() {
  const { tenant } = await requireAdmin();
  const debtors = await listDebtors(tenant.id);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h1 className="text-lg font-bold text-slate-900">Qarzdorlar</h1>
          <span className="text-sm text-slate-500">{debtors.length} ta</span>
        </div>
        {debtors.length > 0 ? (
          <ReminderButton
            action={sendAllRemindersAction}
            label="Barchasiga eslatma yuborish"
            confirm={`${debtors.length} ta qarzdorga eslatma yuborilsinmi?`}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          />
        ) : null}
      </div>

      {debtors.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Qarzdorlar yo'q. ✅
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 font-medium">Kod</th>
                <th className="px-3 py-2 font-medium">Ism</th>
                <th className="px-3 py-2 font-medium">Telefon</th>
                <th className="px-3 py-2 text-right font-medium">Qarz</th>
                <th className="px-3 py-2 text-right font-medium">Amal</th>
              </tr>
            </thead>
            <tbody>
              {debtors.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                >
                  <td className="whitespace-nowrap px-3 py-2 align-middle font-medium">
                    <Link
                      href={`/customers/${c.id}`}
                      className="text-slate-800 hover:underline"
                    >
                      {c.clientCode}
                    </Link>
                  </td>
                  <td className="px-3 py-2 align-middle text-slate-700">
                    {c.fullName ?? '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 align-middle text-slate-700">
                    {c.phone ?? '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right align-middle">
                    <DebtCell tiyin={c.debtTiyin} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right align-middle">
                    <ReminderButton action={sendReminderAction.bind(null, c.id)} />
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

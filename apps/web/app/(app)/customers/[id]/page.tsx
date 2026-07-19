import Link from 'next/link';
import { notFound } from 'next/navigation';

import { formatDate, formatSom, t } from '@kargotrack/shared';

import { DebtCell } from '@/components/debt-cell';
import { ReminderButton } from '@/components/reminder-button';
import { StatusBadge } from '@/components/status-badge';
import { requireAdmin } from '@/lib/auth';
import { getCustomerDetail } from '@/lib/queries';
import { sendReminderAction } from '@/lib/reminder-actions';

import { PaymentForm } from './payment-form';

export const metadata = { title: 'Mijoz — KargoTrack' };

// Uzbek admin labels for payment methods (reuse the canonical i18n catalogue).
const methodLabel = t('uz').paymentMethod;

export default async function CustomerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { tenant } = await requireAdmin();
  const detail = await getCustomerDetail(tenant.id, params.id);
  if (!detail) notFound();

  const { customer, tracks, payments, debtTiyin } = detail;

  return (
    <div className="space-y-4">
      <Link
        href="/customers"
        className="inline-block text-sm text-slate-500 hover:text-slate-800"
      >
        ← Mijozlar
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold text-slate-900">
          {customer.fullName ?? customer.clientCode}
        </h1>
        <span className="font-mono text-sm text-slate-500">
          {customer.clientCode}
        </span>
      </div>

      {/* Info + debt */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Telefon</dt>
            <dd className="text-slate-800">{customer.phone ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Treklar</dt>
            <dd className="text-slate-800">{tracks.length}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">Qarz</dt>
            <dd>
              <DebtCell tiyin={debtTiyin} />
            </dd>
          </div>
        </dl>
        {debtTiyin > 0 ? (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <ReminderButton action={sendReminderAction.bind(null, customer.id)} />
          </div>
        ) : null}
      </section>

      {/* Record a payment */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          To'lov qo'shish
        </h2>
        <PaymentForm customerId={customer.id} />
      </section>

      {/* Payment history */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          To'lovlar tarixi
        </h2>
        {payments.length === 0 ? (
          <p className="text-sm text-slate-400">To'lovlar yo'q.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <div className="min-w-0">
                  <span className="font-medium tabular-nums text-slate-800">
                    {formatSom(p.amountTiyin)} so'm
                  </span>
                  <span className="ml-2 text-slate-500">
                    {methodLabel[p.method]}
                  </span>
                  {p.note ? (
                    <p className="truncate text-xs text-slate-400">{p.note}</p>
                  ) : null}
                </div>
                <span className="whitespace-nowrap text-xs text-slate-500">
                  {formatDate(p.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Tracks */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Treklar</h2>
        {tracks.length === 0 ? (
          <p className="text-sm text-slate-400">Treklar yo'q.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {tracks.map((tr) => (
              <li key={tr.id} className="py-2">
                <Link
                  href={`/tracks/${tr.id}`}
                  className="flex items-center justify-between gap-3 hover:opacity-80"
                >
                  <span className="truncate font-mono text-slate-800">
                    {tr.codeOriginal}
                  </span>
                  <span className="flex items-center gap-3">
                    {tr.priceTiyin != null ? (
                      <span className="whitespace-nowrap tabular-nums text-slate-600">
                        {formatSom(tr.priceTiyin)} so'm
                      </span>
                    ) : null}
                    <StatusBadge status={tr.currentStatus} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

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

  const deliveredCount = tracks.filter(
    (tr) => tr.currentStatus === 'DELIVERED',
  ).length;
  const initials = (customer.fullName ?? '')
    .split(' ')
    .map((p) => p.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="mx-auto max-w-md space-y-3">
      <Link
        href="/customers"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Mijozlar
      </Link>

      {/* Header + stats */}
      <div className="rounded-xl border border-border bg-white p-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-accent text-sm font-bold text-primary">
            {initials || '—'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-foreground">
              {customer.fullName ?? 'Ismi yo‘q'}
            </p>
            <p className="truncate font-mono text-[12.5px] text-muted-foreground">
              {customer.clientCode}
              {customer.phone ? ` · ${customer.phone}` : ''}
            </p>
          </div>
        </div>
        <div className="mt-2.5 flex border-t border-[#eef0f4] pt-2.5 text-center">
          <div className="flex-1">
            <p className="font-mono text-base font-semibold">{tracks.length}</p>
            <p className="text-[11.5px] text-muted-foreground">trek</p>
          </div>
          <div className="flex-1 border-l border-[#eef0f4]">
            <p className="font-mono text-base font-semibold">
              {deliveredCount}
            </p>
            <p className="text-[11.5px] text-muted-foreground">topshirildi</p>
          </div>
          <div className="flex-1 border-l border-[#eef0f4]">
            <div className="text-[13px]">
              <DebtCell tiyin={debtTiyin} />
            </div>
            <p className="text-[11.5px] text-muted-foreground">qarz</p>
          </div>
        </div>
      </div>

      {/* Payment history */}
      <div className="rounded-xl border border-border bg-white p-3.5">
        <h2 className="mb-2 text-[13.5px] font-semibold text-foreground">
          To&apos;lovlar tarixi
        </h2>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">To&apos;lovlar yo&apos;q.</p>
        ) : (
          <ul>
            {payments.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between border-t border-[#eef0f4] py-2.5 first:border-0"
              >
                <div className="min-w-0">
                  <p className="text-[13.5px] font-semibold text-foreground">
                    {methodLabel[p.method]}
                  </p>
                  <p className="mt-0.5 font-mono text-[11.5px] text-muted-foreground">
                    {formatDate(p.createdAt)}
                    {p.note ? ` · ${p.note}` : ''}
                  </p>
                </div>
                <span className="font-mono text-[14px] font-semibold text-[#177338]">
                  {formatSom(p.amountTiyin)} so&apos;m
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add a payment */}
      <div className="rounded-xl border border-border bg-white p-3.5">
        <h2 className="mb-3 text-[13.5px] font-semibold text-foreground">
          To&apos;lov qo&apos;shish
        </h2>
        <PaymentForm customerId={customer.id} />
      </div>

      {debtTiyin > 0 ? (
        <ReminderButton
          action={sendReminderAction.bind(null, customer.id)}
          label="Eslatma yuborish"
          variant="outline"
          size="lg"
          className="w-full"
        />
      ) : null}

      {/* Tracks */}
      <div className="rounded-xl border border-border bg-white p-3.5">
        <h2 className="mb-2 text-[13.5px] font-semibold text-foreground">
          Treklar
        </h2>
        {tracks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Treklar yo&apos;q.</p>
        ) : (
          <ul>
            {tracks.map((tr) => (
              <li
                key={tr.id}
                className="border-t border-[#eef0f4] py-2.5 first:border-0"
              >
                <Link
                  href={`/tracks/${tr.id}`}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="truncate font-mono text-[13px] font-semibold text-foreground">
                    {tr.codeOriginal}
                  </span>
                  <span className="flex flex-none items-center gap-3">
                    {tr.priceTiyin != null ? (
                      <span className="whitespace-nowrap font-mono text-[12.5px] text-slate-600">
                        {formatSom(tr.priceTiyin)} so&apos;m
                      </span>
                    ) : null}
                    <StatusBadge status={tr.currentStatus} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

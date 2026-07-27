import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';

import { formatDate, formatSom, t as strings, type Lang } from '@kargotrack/shared';

import { DebtCell } from '@/components/shared/debt-cell';
import { ExportButton } from '@/components/shared/export-button';
import { ReminderButton } from '@/components/shared/reminder-button';
import { StatusBadge } from '@/components/shared/status-badge';
import { SectionCard } from '@/components/ui/section-card';
import { requireAdmin } from '@/lib/auth';
import { getCustomerDetail } from '@/lib/queries';
import { sendReminderAction } from '@/features/debtors/actions';
import { PaymentForm } from '@/features/customers/components/payment-form';

export async function generateMetadata() {
  const t = await getTranslations('customerDetail');
  return { title: `${t('pageTitle')} — SERVIO Kargo` };
}

/** Two-letter avatar initials, or a dash when the customer has no name yet. */
function initialsOf(fullName: string | null): string {
  return (
    (fullName ?? '')
      .split(' ')
      .map((part) => part.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase() || '—'
  );
}

export default async function CustomerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { tenant } = await requireAdmin();
  const t = await getTranslations('customerDetail');
  const tCommon = await getTranslations('common');
  const tCustomers = await getTranslations('customers');
  const locale = (await getLocale()) as Lang;

  // Payment-method names come from the canonical bot catalogue, not from
  // `messages/*.json`: the customer sees the same words in their receipt.
  const methodLabel = strings(locale).paymentMethod;

  const detail = await getCustomerDetail(tenant.id, params.id);
  if (!detail) notFound();

  const { customer, tracks, payments, debtTiyin } = detail;

  const deliveredCount = tracks.filter(
    (tr) => tr.currentStatus === 'DELIVERED',
  ).length;

  return (
    <div className="mx-auto max-w-md space-y-3">
      <Link
        href="/customers"
        className="inline-flex items-center gap-1.5 rounded text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {tCustomers('pageTitle')}
      </Link>

      {/* Header + stats */}
      <SectionCard>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-accent text-sm font-bold text-primary">
            {initialsOf(customer.fullName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-foreground">
              {customer.fullName ?? tCommon('noName')}
            </p>
            <p className="truncate font-mono text-[12.5px] text-muted-foreground">
              {customer.clientCode}
              {customer.phone ? ` · ${customer.phone}` : ''}
            </p>
          </div>
        </div>
        <div className="mt-2.5 flex border-t border-[#eef0f4] pt-2.5 text-center">
          <div className="flex-1">
            <p className="font-mono text-base font-semibold tabular-nums">
              {tracks.length}
            </p>
            <p className="text-[11.5px] text-muted-foreground">
              {t('statTracks')}
            </p>
          </div>
          <div className="flex-1 border-l border-[#eef0f4]">
            <p className="font-mono text-base font-semibold tabular-nums">
              {deliveredCount}
            </p>
            <p className="text-[11.5px] text-muted-foreground">
              {t('statDelivered')}
            </p>
          </div>
          <div className="flex-1 border-l border-[#eef0f4]">
            <div className="text-[13px]">
              <DebtCell tiyin={debtTiyin} />
            </div>
            <p className="text-[11.5px] text-muted-foreground">{t('statDebt')}</p>
          </div>
        </div>
      </SectionCard>

      {/* Payment history */}
      <SectionCard
        title={t('paymentsTitle')}
        action={
          payments.length > 0 ? (
            <ExportButton href={`/api/export/payments?customer=${customer.id}`} />
          ) : undefined
        }
      >
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noPayments')}</p>
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
                  {formatSom(p.amountTiyin)} {tCommon('som')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* Add a payment */}
      <SectionCard title={t('addPaymentTitle')}>
        <PaymentForm customerId={customer.id} />
      </SectionCard>

      {debtTiyin > 0 ? (
        <ReminderButton
          action={sendReminderAction.bind(null, customer.id)}
          label={t('sendReminder')}
          variant="outline"
          size="lg"
          className="w-full"
        />
      ) : null}

      {/* Tracks */}
      <SectionCard title={t('tracksTitle')}>
        {tracks.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noTracks')}</p>
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
                        {formatSom(tr.priceTiyin)} {tCommon('som')}
                      </span>
                    ) : null}
                    <StatusBadge status={tr.currentStatus} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

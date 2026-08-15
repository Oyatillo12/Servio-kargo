import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';

import {
  can,
  formatDate,
  formatSom,
  t as strings,
  type Lang,
} from '@kargotrack/shared';

import { DebtCell } from '@/components/shared/debt-cell';
import { ExportButton } from '@/components/shared/export-button';
import { MessageOutcomesCard } from '@/components/shared/message-outcomes';
import { ReminderButton } from '@/components/shared/reminder-button';
import { StatusBadge } from '@/components/shared/status-badge';
import { SectionCard } from '@/components/ui/section-card';
import { requireCapability } from '@/lib/auth';
import {
  getCustomerDetail,
  isCustomerBotBlocked,
  listCustomerMessages,
} from '@/lib/queries';
import { sendReminderAction } from '@/features/debtors/actions';
import { CancelPaymentButton } from '@/features/customers/components/cancel-payment-button';
import { EditCustomerButton } from '@/features/customers/components/edit-customer-button';
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
  const { tenant, role } = await requireCapability('customers.view');
  const t = await getTranslations('customerDetail');
  const tCommon = await getTranslations('common');
  const tCustomers = await getTranslations('customers');
  const locale = (await getLocale()) as Lang;

  const canSeeMoney = can(role, 'money.reports');
  const canManage = can(role, 'customers.manage');
  const canRecordPayment = can(role, 'payments.record');
  const canCancelPayment = can(role, 'payments.cancel');
  const canRemind = can(role, 'reminders.send');
  const canExport = can(role, 'export.data');

  // Payment-method names come from the canonical bot catalogue, not from
  // `messages/*.json`: the customer sees the same words in their receipt.
  const methodLabel = strings(locale).paymentMethod;

  const detail = await getCustomerDetail(tenant.id, params.id);
  if (!detail) notFound();

  const { customer, tracks, payments, debtTiyin } = detail;

  // Delivery outcomes (AUDIT.md T13): "did they actually get the message?"
  const [messages, botBlocked] = await Promise.all([
    listCustomerMessages(tenant.id, customer.id),
    isCustomerBotBlocked(tenant.id, customer.id),
  ]);

  const deliveredCount = tracks.filter(
    (tr) => tr.currentStatus === 'DELIVERED',
  ).length;

  // Originals that have been voided (tasks.md A7): a storno row points back at
  // its original, so both render differently and neither can be voided again.
  const reversedIds = new Set(
    payments.filter((p) => p.reversalOf != null).map((p) => p.reversalOf),
  );

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
            {botBlocked ? (
              <p className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-[#fef3c7] px-2 py-0.5 text-[11px] font-semibold text-[#92400e]">
                🚫 {t('botBlocked')}
              </p>
            ) : null}
            <p className="truncate font-mono text-[12.5px] text-muted-foreground">
              {customer.clientCode}
              {customer.phone ? ` · ${customer.phone}` : ''}
            </p>
          </div>
          {canManage ? (
            <EditCustomerButton
              customerId={customer.id}
              initialName={customer.fullName}
              initialPhone={customer.phone}
            />
          ) : null}
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

      {/* Payment history. The balance above stays visible to every role — the
          person handing a parcel over the counter has to know whether it is
          paid for — but the ledger behind it, and taking money, do not. */}
      {canSeeMoney ? (
        <SectionCard
          title={t('paymentsTitle')}
          action={
            payments.length > 0 && canExport ? (
              <ExportButton href={`/api/export/payments?customer=${customer.id}`} />
            ) : undefined
          }
        >
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noPayments')}</p>
          ) : (
            <ul>
              {payments.map((p) => {
                const isStorno = p.reversalOf != null;
                const isReversed = reversedIds.has(p.id);
                return (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 border-t border-[#eef0f4] py-2.5 first:border-0"
                  >
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-semibold text-foreground">
                        {isStorno
                          ? `${t('stornoLabel')} · ${methodLabel[p.method]}`
                          : methodLabel[p.method]}
                        {isReversed ? (
                          <span className="ms-1.5 rounded-full bg-[#fef3c7] px-2 py-0.5 text-[11px] font-semibold text-[#92400e]">
                            {t('stornoCanceledBadge')}
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 font-mono text-[11.5px] text-muted-foreground">
                        {formatDate(p.createdAt)}
                        {/* Who took (or voided) it. The whole reason
                            payments.created_by exists: cash crosses a counter
                            and the row has to say whose counter. Absent only
                            on rows written before T8. */}
                        {p.authorName ? ` · ${p.authorName}` : ''}
                        {p.note ? ` · ${p.note}` : ''}
                      </p>
                    </div>
                    <span className="flex flex-none items-center gap-1">
                      <span
                        className={
                          isStorno
                            ? 'font-mono text-[14px] font-semibold text-[#b91c1c]'
                            : isReversed
                              ? 'font-mono text-[14px] font-semibold text-muted-foreground line-through'
                              : 'font-mono text-[14px] font-semibold text-[#177338]'
                        }
                      >
                        {formatSom(p.amountTiyin)} {tCommon('som')}
                      </span>
                      {canCancelPayment && !isStorno && !isReversed ? (
                        <CancelPaymentButton
                          paymentId={p.id}
                          amountText={`${formatSom(p.amountTiyin)} ${tCommon('som')}`}
                        />
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      ) : null}

      {/* Add a payment */}
      {canRecordPayment ? (
        <SectionCard title={t('addPaymentTitle')}>
          <PaymentForm customerId={customer.id} />
        </SectionCard>
      ) : null}

      {debtTiyin > 0 && canRemind ? (
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

      <MessageOutcomesCard messages={messages} />
    </div>
  );
}

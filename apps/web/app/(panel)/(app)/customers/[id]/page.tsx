import Link from 'next/link';
import { notFound } from 'next/navigation';
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
import { DetailColumns, DetailShell } from '@/components/layout/detail-shell';
import { DataItem, DataList } from '@/components/ui/data-list';
import { SectionCard } from '@/components/ui/section-card';
import { resolveTab, type TabItem } from '@/components/ui/tabs';
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

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string };
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

  // The ledger is a tab of its own, and it only exists for roles that may read
  // money at all (rule 9). The balance itself stays in the head for everyone —
  // whoever hands a parcel over the counter has to know whether it is paid for.
  const tabs: TabItem[] = [
    { key: 'umumiy', label: t('tabGeneral') },
    { key: 'tracks', label: t('tabTracks'), count: tracks.length },
    ...(canSeeMoney
      ? [{ key: 'payments', label: t('tabPayments'), count: payments.length }]
      : []),
    { key: 'messages', label: t('tabMessages'), count: messages.length },
  ];
  const tab = resolveTab(tabs, searchParams.tab);
  const tabHref = (key: string) =>
    key === 'umumiy'
      ? `/customers/${customer.id}`
      : `/customers/${customer.id}?tab=${key}`;

  return (
    <DetailShell
      backHref="/customers"
      backLabel={tCustomers('pageTitle')}
      eyebrow={t('eyebrow')}
      title={customer.fullName ?? tCommon('noName')}
      status={
        <span className="text-lead">
          <DebtCell tiyin={debtTiyin} />
        </span>
      }
      tabs={tabs}
      activeTab={tab}
      buildTabHref={tabHref}
    >
      {tab === 'umumiy' ? (
        <DetailColumns
          main={
            <>
              <DataList className="overflow-hidden rounded-lg border border-rule">
                <DataItem label={t('statTracks')} value={tracks.length} />
                <DataItem label={t('statDelivered')} value={deliveredCount} />
                <DataItem
                  label={t('statDebt')}
                  value={formatSom(debtTiyin)}
                  unit={tCommon('som')}
                  tone={debtTiyin > 0 ? 'debt' : undefined}
                  className="col-span-2"
                />
              </DataList>

              {canRecordPayment ? (
                <SectionCard title={t('addPaymentTitle')}>
                  <PaymentForm customerId={customer.id} />
                </SectionCard>
              ) : null}
            </>
          }
          side={
            <>
              <SectionCard>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-body font-semibold text-ink">
                      {customer.clientCode}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-small text-ink-2">
                      {customer.phone ?? tCommon('dash')}
                    </p>
                    {botBlocked ? (
                      <p className="mt-2 inline-flex items-center gap-1 rounded-sm border border-warning/30 bg-[var(--st-china-bg)] px-2 py-0.5 text-micro font-semibold text-warning">
                        🚫 {t('botBlocked')}
                      </p>
                    ) : null}
                  </div>
                  {canManage ? (
                    <EditCustomerButton
                      customerId={customer.id}
                      initialName={customer.fullName}
                      initialPhone={customer.phone}
                    />
                  ) : null}
                </div>
              </SectionCard>

              {debtTiyin > 0 && canRemind ? (
                <ReminderButton
                  action={sendReminderAction.bind(null, customer.id)}
                  label={t('sendReminder')}
                  variant="outline"
                  size="lg"
                  className="w-full"
                />
              ) : null}
            </>
          }
        />
      ) : null}

      {tab === 'tracks' ? (
        <SectionCard title={t('tracksTitle')} flush>
          {tracks.length === 0 ? (
            <p className="px-4 pb-4 text-small text-muted-foreground">
              {t('noTracks')}
            </p>
          ) : (
            <ul>
              {tracks.map((tr) => (
                <li key={tr.id} className="border-t border-rule-soft">
                  <Link
                    href={`/tracks/${tr.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-surface-alt"
                  >
                    <span className="truncate font-mono text-small font-semibold text-foreground">
                      {tr.codeOriginal}
                    </span>
                    <span className="flex flex-none items-center gap-3">
                      {tr.priceTiyin != null ? (
                        <span className="whitespace-nowrap font-mono text-small tabular-nums text-ink-2">
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
      ) : null}

      {/* The ledger behind the balance, and taking money, are money.reports —
          the tab does not exist for roles that may not read it. */}
      {tab === 'payments' && canSeeMoney ? (
        <SectionCard
          title={t('paymentsTitle')}
          flush
          action={
            payments.length > 0 && canExport ? (
              <ExportButton href={`/api/export/payments?customer=${customer.id}`} />
            ) : undefined
          }
        >
          {payments.length === 0 ? (
            <p className="px-4 pb-4 text-small text-muted-foreground">
              {t('noPayments')}
            </p>
          ) : (
            <ul>
              {payments.map((p) => {
                const isStorno = p.reversalOf != null;
                const isReversed = reversedIds.has(p.id);
                return (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 border-t border-rule-soft px-4 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-small font-semibold text-foreground">
                        {isStorno
                          ? `${t('stornoLabel')} · ${methodLabel[p.method]}`
                          : methodLabel[p.method]}
                        {isReversed ? (
                          <span className="ms-1.5 rounded-sm border border-warning/30 bg-[var(--st-china-bg)] px-1.5 py-0.5 text-micro font-semibold text-warning">
                            {t('stornoCanceledBadge')}
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 font-mono text-micro text-faint">
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
                            ? 'font-mono text-small font-semibold tabular-nums text-destructive'
                            : isReversed
                              ? 'font-mono text-small font-semibold tabular-nums text-faint line-through'
                              : 'font-mono text-small font-semibold tabular-nums text-success'
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

      {tab === 'messages' ? <MessageOutcomesCard messages={messages} /> : null}
    </DetailShell>
  );
}

import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { z } from 'zod';

import {
  DEBT_OWED_STATUSES,
  can,
  isHandoverEligible,
  t as strings,
  type Lang,
} from '@kargotrack/shared';

import { DebtCell } from '@/components/shared/debt-cell';
import { SectionCard } from '@/components/ui/section-card';
import { requireCapability } from '@/lib/auth';
import { getCustomerDetail } from '@/lib/queries';
import { HandoverForm, type HandoverTrackRow } from '@/features/handover/components/handover-form';
import { HandoverPicker } from '@/features/handover/components/handover-picker';

export async function generateMetadata() {
  const t = await getTranslations('handover');
  return { title: `${t('pageTitle')} — SERVIO Kargo` };
}

/**
 * The pickup counter (SPEC §5.15, tasks.md G, D-003): pick the customer, pick
 * the parcels, take the money — DELIVERED + payment in one action. Guarded by
 * `tracks.status`; the money half exists only for `payments.record` (a
 * warehouse hand hands over, never takes cash).
 */
export default async function HandoverPage({
  searchParams,
}: {
  searchParams: { customer?: string };
}) {
  const { tenant, role } = await requireCapability('tracks.status');
  const t = await getTranslations('handover');
  const tCommon = await getTranslations('common');
  const locale = (await getLocale()) as Lang;
  const canTakePayment = can(role, 'payments.record');

  const customerId = z.string().uuid().safeParse(searchParams.customer);

  if (!customerId.success) {
    return (
      <div className="mx-auto max-w-md space-y-3">
        <h1 className="text-title font-semibold text-foreground">
          {t('pageTitle')}
        </h1>
        <SectionCard>
          <p className="mb-3 text-sm text-muted-foreground">
            {t('pickCustomerHint')}
          </p>
          <HandoverPicker variant="start" />
        </SectionCard>
      </div>
    );
  }

  const detail = await getCustomerDetail(tenant.id, customerId.data);
  if (!detail) notFound();
  const { customer, tracks, debtTiyin } = detail;

  // §5.15 step 2: the two Tashkent statuses, READY first, oldest first inside
  // a group — the parcel that has waited longest is the one on top of the pile.
  const eligible = tracks
    .filter((tr) =>
      isHandoverEligible({
        currentStatus: tr.currentStatus,
        priceTiyin: tr.priceTiyin,
        deletedAt: tr.deletedAt,
      }),
    )
    .sort((a, b) => {
      if (a.currentStatus !== b.currentStatus) {
        return a.currentStatus === 'READY_FOR_PICKUP' ? -1 : 1;
      }
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

  const rows: HandoverTrackRow[] = eligible.map((tr) => ({
    id: tr.id,
    codeOriginal: tr.codeOriginal,
    currentStatus: tr.currentStatus,
    weightGrams: tr.weightGrams,
    priceTiyin: tr.priceTiyin,
    // The §7.5 rule has ONE home — the same array the debt aggregate uses —
    // so the after-balance preview can never drift from the real balance.
    countsTowardDebt: DEBT_OWED_STATUSES.includes(tr.currentStatus),
  }));

  // Payment-method names come from the canonical bot catalogue (rule 5) — the
  // customer sees the same words in their receipt.
  const methodLabels = strings(locale).paymentMethod;

  return (
    <div className="mx-auto max-w-md space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="min-w-0 truncate text-title font-semibold text-foreground">
          {t('pageTitle')}
        </h1>
        <HandoverPicker variant="change" />
      </div>

      {/* Who is standing at the counter + where their balance stands now. */}
      <SectionCard>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-foreground">
              {customer.fullName ?? tCommon('noName')}
            </p>
            <p className="truncate font-mono text-micro text-muted-foreground">
              {customer.clientCode}
              {customer.phone ? ` · ${customer.phone}` : ''}
            </p>
          </div>
          <div className="flex-none text-right">
            <p className="text-micro text-muted-foreground">
              {t('balanceNow')}
            </p>
            <div className="text-small">
              <DebtCell tiyin={debtTiyin} />
            </div>
          </div>
        </div>
      </SectionCard>

      <HandoverForm
        customerId={customer.id}
        tracks={rows}
        debtTiyin={debtTiyin}
        canTakePayment={canTakePayment}
        methodLabels={methodLabels}
      />
    </div>
  );
}

'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { CustomerPickerSheet } from '@/features/customers/components/customer-picker';
import type { CustomerOption } from '@/lib/customer-types';

import { assignTracksCustomerAction } from '../actions';

/**
 * Bulk "assign to customer" (SPEC §5.2). The day-0 flow: filter the tracks list
 * to one customer's codes, select them, pick (or create) the customer. Tracks
 * that already belong to that customer are counted as skipped rather than
 * rewritten, so re-running the assignment is harmless.
 */
export function CustomerAssignDialog({
  trackIds,
  open,
  onOpenChange,
  onDone,
}: {
  trackIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}) {
  const t = useTranslations('tracks');
  const [, startTransition] = useTransition();

  function pick(customer: CustomerOption) {
    startTransition(async () => {
      const res = await assignTracksCustomerAction({
        trackIds,
        customerId: customer.id,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const skipped = res.skipped ?? 0;
      toast.success(
        [
          t('customerAssigned', {
            count: res.changed ?? 0,
            clientCode: customer.clientCode,
          }),
          skipped > 0 ? t('customerAlreadyOwned', { count: skipped }) : null,
        ]
          .filter(Boolean)
          .join(' · '),
      );
      onOpenChange(false);
      onDone?.();
    });
  }

  return (
    <CustomerPickerSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('bulkAssignCustomer')}
      hint={t('customerDialogHint', { count: trackIds.length })}
      onPick={pick}
    />
  );
}

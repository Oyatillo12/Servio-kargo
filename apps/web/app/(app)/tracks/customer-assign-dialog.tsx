'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';

import { CustomerPickerSheet } from '@/components/customer-picker';
import type { CustomerOption } from '@/lib/customer-types';

import { assignTracksCustomerAction } from './actions';

/**
 * Bulk "Mijozga biriktirish" (SPEC §5.2). The day-0 flow: filter the tracks
 * list to one customer's codes, select them, pick (or create) the customer.
 * Tracks that already belong to that customer are counted as skipped rather
 * than rewritten, so re-running the assignment is harmless.
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
        `${res.changed ?? 0} ta trek ${customer.clientCode} mijoziga biriktirildi` +
          (skipped > 0 ? ` · ${skipped} ta allaqachon shu mijozda edi` : ''),
      );
      onOpenChange(false);
      onDone?.();
    });
  }

  return (
    <CustomerPickerSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Mijozga biriktirish"
      hint={
        <>
          <b>{trackIds.length} ta trek</b> tanlandi. Mijozga xabar yuborilmaydi.
        </>
      }
      onPick={pick}
    />
  );
}

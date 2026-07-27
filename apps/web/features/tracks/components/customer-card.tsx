'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Phone, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { CustomerPickerSheet } from '@/features/customers/components/customer-picker';
import { Button } from '@/components/ui/button';
import { SectionCard } from '@/components/ui/section-card';
import type { CustomerOption } from '@/lib/customer-types';

import { attachCustomerAction, detachCustomerAction } from '../detail-actions';

export interface TrackCustomerView {
  id: string;
  clientCode: string;
  fullName: string | null;
  phone: string | null;
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

/**
 * Customer card on the track detail page (SPEC §5.3). Shows the owner with a
 * profile/call shortcut, or an "attach" call to action when the track is
 * unclaimed — the state most tracks are in right after a channel-history
 * import. "Change" fixes the §7.3 case where the wrong customer claimed the
 * code; "detach" clears it.
 */
export function CustomerCard({
  trackId,
  customer,
}: {
  trackId: string;
  customer: TrackCustomerView | null;
}) {
  const t = useTranslations('trackDetail');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function attach(picked: CustomerOption) {
    startTransition(async () => {
      const res = await attachCustomerAction({ trackId, customerId: picked.id });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t('attached', { clientCode: picked.clientCode }));
      setPickerOpen(false);
      router.refresh();
    });
  }

  function detach() {
    startTransition(async () => {
      const res = await detachCustomerAction(trackId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t('detached'));
      router.refresh();
    });
  }

  return (
    <SectionCard>
      {customer ? (
        <>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-accent text-sm font-bold text-primary">
              {initialsOf(customer.fullName)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                {customer.fullName ?? tCommon('noName')}
              </p>
              <p className="truncate font-mono text-[12px] text-muted-foreground">
                {customer.clientCode}
                {customer.phone ? ` · ${customer.phone}` : ''}
              </p>
            </div>
            <div className="flex flex-none items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/customers/${customer.id}`}>{t('profile')}</Link>
              </Button>
              {customer.phone ? (
                <Button asChild variant="outline" size="icon" aria-label={t('call')}>
                  <a href={`tel:${customer.phone}`}>
                    <Phone className="h-4 w-4" aria-hidden />
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
          <div className="mt-3 flex gap-2.5 border-t border-[#eef0f4] pt-3">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setPickerOpen(true)}
              disabled={isPending}
            >
              {t('changeCustomer')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-destructive"
              onClick={detach}
              disabled={isPending}
            >
              {t('detachCustomer')}
            </Button>
          </div>
        </>
      ) : (
        <div className="flex items-center gap-3">
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            {t('customerNotAssigned')}
          </p>
          <Button
            size="sm"
            className="flex-none"
            onClick={() => setPickerOpen(true)}
            disabled={isPending}
          >
            <UserPlus className="mr-2 h-4 w-4" aria-hidden />
            {t('attach')}
          </Button>
        </div>
      )}

      <CustomerPickerSheet
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title={t('attachTitle')}
        onPick={attach}
      />
    </SectionCard>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { CustomerOption } from '@/lib/customer-types';

import { CustomerPickerSheet } from './customer-picker';
import { PaymentForm } from './payment-form';

/**
 * Record a payment without first navigating to a customer (design 1a/1b: the
 * dashboard's second primary action).
 *
 * Payments are the one thing an admin does while a person is standing at the
 * counter, and until now it took three screens to reach: customers → search →
 * profile → form. Two steps here: pick who paid, then how much.
 *
 * The picker is the same sheet every assignment flow uses, so a walk-in who is
 * not in the system yet can be created inline and paid for in one go.
 */
export function QuickPaymentSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('customerDetail');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerOption | null>(null);

  function close() {
    onOpenChange(false);
    setCustomer(null);
  }

  return (
    <>
      <CustomerPickerSheet
        open={open && customer == null}
        onOpenChange={(o) => !o && close()}
        title={t('addPaymentTitle')}
        onPick={setCustomer}
      />

      <Sheet
        open={open && customer != null}
        onOpenChange={(o) => {
          // Backing out of the amount step returns to the picker rather than
          // dropping the whole flow — the wrong person is a one-tap mistake.
          if (!o) setCustomer(null);
        }}
      >
        <SheetContent side="bottom" className="flex flex-col gap-3">
          <SheetHeader>
            <SheetTitle>
              {customer?.fullName ?? tCommon('noName')}{' '}
              <span className="font-mono text-small font-medium text-muted-foreground">
                {customer?.clientCode}
              </span>
            </SheetTitle>
          </SheetHeader>
          {customer ? (
            <PaymentForm
              customerId={customer.id}
              onSaved={() => {
                close();
                router.refresh();
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

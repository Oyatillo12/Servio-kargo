'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { CreateCustomerForm } from '@/features/customers/components/customer-picker';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

/**
 * The create-a-customer sheet (SPEC §5.5). Needed because a cargo company's
 * existing customers are on paper long before they open the bot — without
 * this, tracks imported on day 0 have nobody to attach to. Created customers
 * land on their profile so a payment or track can be added at once.
 *
 * Controlled, so the dashboard can open it from the header's action menu and
 * `/customers` from its own button.
 */
export function NewCustomerSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('customers');
  const router = useRouter();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex flex-col gap-3">
        <SheetHeader>
          <SheetTitle>{t('newCustomer')}</SheetTitle>
        </SheetHeader>
        <CreateCustomerForm
          onCancel={() => onOpenChange(false)}
          onCreated={(c) => {
            toast.success(t('created', { clientCode: c.clientCode }));
            onOpenChange(false);
            router.push(`/customers/${c.id}`);
            router.refresh();
          }}
        />
      </SheetContent>
    </Sheet>
  );
}

/** "New customer" entry point on `/customers`. */
export function NewCustomerButton() {
  const t = useTranslations('customers');
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4" aria-hidden />
        {t('newCustomer')}
      </Button>

      <NewCustomerSheet open={open} onOpenChange={setOpen} />
    </>
  );
}

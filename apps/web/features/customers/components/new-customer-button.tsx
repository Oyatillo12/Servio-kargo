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
 * "New customer" entry point on /customers (SPEC §5.5). Needed because a cargo
 * company's existing customers are on paper long before they open the bot —
 * without this, tracks imported on day 0 have nobody to attach to. Created
 * customers land on their profile so a payment or track can be added at once.
 */
export function NewCustomerButton() {
  const t = useTranslations('customers');
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <UserPlus className="mr-2 h-4 w-4" aria-hidden />
        {t('newCustomer')}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="flex flex-col gap-3">
          <SheetHeader>
            <SheetTitle>{t('newCustomer')}</SheetTitle>
          </SheetHeader>
          <CreateCustomerForm
            onCancel={() => setOpen(false)}
            onCreated={(c) => {
              toast.success(t('created', { clientCode: c.clientCode }));
              setOpen(false);
              router.push(`/customers/${c.id}`);
              router.refresh();
            }}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}

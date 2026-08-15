'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { UserSearch } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { CustomerPickerSheet } from '@/features/customers/components/customer-picker';

/**
 * Step 1 of the counter flow (SPEC §5.15): pick who is standing at the
 * counter. The same picker sheet every assignment flow uses; picking routes to
 * `/handover?customer={id}`, so the URL is shareable/refreshable mid-service.
 */
export function HandoverPicker({
  variant = 'start',
}: {
  /** `start` = the big empty-screen button; `change` = the small header one. */
  variant?: 'start' | 'change';
}) {
  const t = useTranslations('handover');
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      {variant === 'start' ? (
        <Button size="lg" className="w-full" onClick={() => setOpen(true)}>
          <UserSearch className="h-5 w-5" aria-hidden />
          {t('pickCustomer')}
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          {t('changeCustomer')}
        </Button>
      )}

      <CustomerPickerSheet
        open={open}
        onOpenChange={setOpen}
        title={t('pickCustomer')}
        onPick={(c) => {
          setOpen(false);
          router.push(`/handover?customer=${c.id}`);
        }}
      />
    </>
  );
}

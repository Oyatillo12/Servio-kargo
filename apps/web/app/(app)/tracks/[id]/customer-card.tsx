'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Phone, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

import { CustomerPickerSheet } from '@/components/customer-picker';
import { Button } from '@/components/ui/button';
import type { CustomerOption } from '@/lib/customer-types';

import { attachCustomerAction, detachCustomerAction } from './actions';

export interface TrackCustomerView {
  id: string;
  clientCode: string;
  fullName: string | null;
  phone: string | null;
}

/**
 * Customer card on the track detail page (SPEC §5.3). Shows the owner with a
 * profile/call shortcut, or an "attach" call to action when the track is
 * unclaimed — the state most tracks are in right after a channel-history
 * import. `O'zgartirish` fixes the §7.3 case where the wrong customer claimed
 * the code; `Ajratish` clears it.
 */
export function CustomerCard({
  trackId,
  customer,
}: {
  trackId: string;
  customer: TrackCustomerView | null;
}) {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const initials = (customer?.fullName ?? '')
    .split(' ')
    .map((p) => p.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  function attach(picked: CustomerOption) {
    startTransition(async () => {
      const res = await attachCustomerAction({
        trackId,
        customerId: picked.id,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`${picked.clientCode} mijoziga biriktirildi`);
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
      toast.success('Mijozdan ajratildi');
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-border bg-white p-3.5">
      {customer ? (
        <>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-accent text-sm font-bold text-primary">
              {initials || '—'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                {customer.fullName ?? 'Ismi yo‘q'}
              </p>
              <p className="truncate font-mono text-[12px] text-muted-foreground">
                {customer.clientCode}
                {customer.phone ? ` · ${customer.phone}` : ''}
              </p>
            </div>
            <div className="flex flex-none items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/customers/${customer.id}`}>Profil</Link>
              </Button>
              {customer.phone ? (
                <Button
                  asChild
                  variant="outline"
                  size="icon"
                  aria-label="Qo'ng'iroq"
                >
                  <a href={`tel:${customer.phone}`}>
                    <Phone className="h-4 w-4" />
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
              O&apos;zgartirish
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-destructive"
              onClick={detach}
              disabled={isPending}
            >
              Ajratish
            </Button>
          </div>
        </>
      ) : (
        <div className="flex items-center gap-3">
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            Mijozga biriktirilmagan.
          </p>
          <Button
            size="sm"
            className="flex-none"
            onClick={() => setPickerOpen(true)}
            disabled={isPending}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Biriktirish
          </Button>
        </div>
      )}

      <CustomerPickerSheet
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Mijozga biriktirish"
        onPick={attach}
      />
    </div>
  );
}

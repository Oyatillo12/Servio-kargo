'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

import { updateCustomerAction } from '../actions';

/**
 * Pencil + dialog for editing a customer's name/phone on their detail page
 * (tasks.md A6). Rendered only for `customers.manage`; the action re-checks
 * (CLAUDE.md rule 9). Phone is required, same rule as creation — the bot links
 * the record on this number (§7.12).
 */
export function EditCustomerButton({
  customerId,
  initialName,
  initialPhone,
}: {
  customerId: string;
  initialName: string | null;
  initialPhone: string | null;
}) {
  const t = useTranslations('customers');
  const tDetail = useTranslations('customerDetail');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(initialPhone ?? '');
  const [fullName, setFullName] = useState(initialName ?? '');
  const [isPending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await updateCustomerAction({ customerId, phone, fullName });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(tDetail('editSaved'));
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={tDetail('editTitle')}
        onClick={() => {
          // Reset to what is on screen — an abandoned edit must not linger.
          setPhone(initialPhone ?? '');
          setFullName(initialName ?? '');
          setOpen(true);
        }}
      >
        <Pencil className="h-4 w-4" aria-hidden />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tDetail('editTitle')}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-customer-name">{t('formName')}</Label>
              <Input
                id="edit-customer-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={120}
                placeholder={t('formNamePlaceholder')}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-customer-phone">{t('formPhone')}</Label>
              <Input
                id="edit-customer-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                placeholder={t('formPhonePlaceholder')}
                className="font-mono"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              {tCommon('cancel')}
            </Button>
            <Button className="flex-1" onClick={submit} disabled={isPending}>
              {isPending ? <Spinner /> : null}
              {tCommon('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

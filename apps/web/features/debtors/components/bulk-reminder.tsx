'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { sendAllRemindersAction } from '@/features/debtors/actions';

/** "Send reminder to all debtors" with a confirm modal (design screen 12). */
export function BulkReminder({
  count,
  totalDebtText,
}: {
  count: number;
  totalDebtText: string;
}) {
  const t = useTranslations('debtors');
  const tCommon = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function send() {
    startTransition(async () => {
      const res = await sendAllRemindersAction();
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t('remindersSent', { count: res.count ?? 0 }));
      setOpen(false);
    });
  }

  return (
    <>
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
        {t('remindAll')}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('remindDialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('remindDialogBody', { count, total: totalDebtText })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              {tCommon('cancel')}
            </Button>
            <Button className="flex-1" onClick={send} disabled={pending}>
              {pending ? <Spinner /> : null}
              {tCommon('send')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

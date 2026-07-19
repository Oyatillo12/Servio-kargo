'use client';

import { useState, useTransition } from 'react';
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
import { sendAllRemindersAction } from '@/lib/reminder-actions';

/** "Send reminder to all debtors" with a confirm modal (design screen 12). */
export function BulkReminder({
  count,
  totalDebtText,
}: {
  count: number;
  totalDebtText: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function send() {
    startTransition(async () => {
      const res = await sendAllRemindersAction();
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`${res.count ?? 0} ta eslatma yuborildi`);
      setOpen(false);
    });
  }

  return (
    <>
      <Button
        variant="outline"
        className="w-full"
        onClick={() => setOpen(true)}
      >
        Barchasiga eslatma yuborish
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eslatma yuborish</DialogTitle>
            <DialogDescription>
              <b>{count} ta qarzdorga</b> eslatma yuboriladi. Jami qarz:{' '}
              <span className="font-mono font-semibold">{totalDebtText}</span>.
              Davom etamizmi?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Bekor qilish
            </Button>
            <Button className="flex-1" onClick={send} disabled={pending}>
              {pending ? 'Yuborilmoqda…' : 'Yuborish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

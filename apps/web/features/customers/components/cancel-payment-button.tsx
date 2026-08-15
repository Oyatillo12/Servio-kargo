'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Undo2 } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

import { reversePaymentAction } from '../actions';

/**
 * Storno control on a payment row (tasks.md A7). Rendered only for
 * `payments.cancel`; the action re-checks (CLAUDE.md rule 9). The reason is
 * required — it becomes the storno row's note, i.e. the audit trail.
 */
export function CancelPaymentButton({
  paymentId,
  amountText,
}: {
  paymentId: string;
  amountText: string;
}) {
  const t = useTranslations('customerDetail');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [isPending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await reversePaymentAction({ paymentId, reason });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t('stornoDone'));
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground"
        aria-label={t('stornoTitle')}
        onClick={() => {
          setReason('');
          setOpen(true);
        }}
      >
        <Undo2 className="h-4 w-4" aria-hidden />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('stornoTitle')}</DialogTitle>
            <DialogDescription>
              {t('stornoBody', { amount: amountText })}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="storno-reason">{t('stornoReason')}</Label>
            <Input
              id="storno-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={255}
              placeholder={t('stornoReasonPlaceholder')}
            />
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
            <Button
              variant="destructive"
              className="flex-1"
              onClick={submit}
              disabled={isPending || reason.trim().length < 3}
            >
              {isPending ? <Spinner /> : null}
              {t('stornoConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

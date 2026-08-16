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
import { Spinner } from '@/components/ui/spinner';

import { undoImportAction } from '../actions';

/**
 * Take back an import (SPEC §7.18, D-010).
 *
 * Behind a confirm dialog, and the dialog names what the run wrote: an undo
 * that reverses thousands of rows is not a click to make by accident. The
 * result is a toast with BOTH numbers — what went back, and what was left
 * alone because somebody had already worked on it.
 */
export function UndoImportButton({
  runId,
  minutesLeft,
  summary,
  variant = 'link',
}: {
  runId: string;
  /** Whole minutes left in the window, for the button's own countdown. */
  minutesLeft: number;
  /** `120 created · 30 updated`, so the dialog says what is being undone. */
  summary: string;
  variant?: 'link' | 'button';
}) {
  const t = useTranslations('import');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await undoImportAction(runId);
      if (!res.ok) {
        toast.error(res.error ?? tCommon('errorGeneric'));
        setOpen(false);
        router.refresh();
        return;
      }
      toast.success(
        t('undoDone', { reverted: res.reverted ?? 0, skipped: res.skipped ?? 0 }),
      );
      // Already-delivered notifications cannot be recalled (§7.18) — saying so
      // is the whole reason the count is carried back.
      if (res.notified) {
        toast.info(t('undoNotified', { count: res.notified }));
      }
      setOpen(false);
      router.refresh();
    });
  }

  const label = t('undoWithin', { minutes: minutesLeft });

  return (
    <>
      {variant === 'button' ? (
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => setOpen(true)}
        >
          <Undo2 className="h-4 w-4" aria-hidden />
          {label}
        </Button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-micro font-semibold text-destructive transition-colors hover:bg-destructive/10"
        >
          <Undo2 className="h-3.5 w-3.5" aria-hidden />
          {label}
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('undoTitle')}</DialogTitle>
            <DialogDescription>
              {t('undoBody', { summary })}
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
            <Button
              variant="destructive"
              className="flex-1"
              onClick={submit}
              disabled={pending}
            >
              {pending ? <Spinner /> : null}
              {t('undoConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

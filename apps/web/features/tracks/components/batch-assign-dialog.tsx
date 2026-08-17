'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

export interface BatchOption {
  id: string;
  label: string;
}

const NONE = '__none__';

/**
 * Bottom-sheet batch assigner (SPEC §5.2 "Reysga biriktirish"). Attach the
 * selected tracks to a batch, or detach them.
 */
export function BatchAssignDialog({
  trackIds,
  batches,
  open,
  onOpenChange,
  onDone,
}: {
  trackIds: string[];
  batches: BatchOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}) {
  const t = useTranslations('tracks');
  const tCommon = useTranslations('common');
  const [value, setValue] = useState<string>(batches[0]?.id ?? NONE);
  const [isPending, startTransition] = useTransition();

  function confirm() {
    const batchId = value === NONE ? null : value;
    startTransition(async () => {
      const { assignTracksToBatchAction } = await import('../actions');
      const res = await assignTracksToBatchAction({ trackIds, batchId });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const count = res.assigned ?? 0;
      toast.success(
        batchId ? t('batchAssigned', { count }) : t('batchDetached', { count }),
      );
      onOpenChange(false);
      onDone?.();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex flex-col gap-4">
        <SheetHeader>
          <SheetTitle>{t('batchDialogTitle')}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="assign-batch">{t('batchLabel')}</Label>
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger id="assign-batch">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {batches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.label}
                </SelectItem>
              ))}
              <SelectItem value={NONE}>{t('batchRemove')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <p className="rounded-lg border border-signal/25 bg-signal-soft px-3 py-2.5 text-small text-ink-2">
          {t('tracksSelected', { count: trackIds.length })}
        </p>

        <div className="flex gap-2.5">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {tCommon('cancel')}
          </Button>
          <Button className="flex-1" onClick={confirm} disabled={isPending}>
            {isPending ? <Spinner /> : null}
            {tCommon('confirm')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

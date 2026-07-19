'use client';

import { useState, useTransition } from 'react';
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

export interface BatchOption {
  id: string;
  label: string;
}

const NONE = '__none__';

/**
 * Bottom-sheet batch assigner (SPEC §5.2 "Reysga biriktirish"). Attach the
 * selected tracks to a batch, or detach them ("Reysdan chiqarish").
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
  const [value, setValue] = useState<string>(batches[0]?.id ?? NONE);
  const [isPending, startTransition] = useTransition();

  function confirm() {
    const batchId = value === NONE ? null : value;
    startTransition(async () => {
      const { assignTracksToBatchAction } = await import('./actions');
      const res = await assignTracksToBatchAction({ trackIds, batchId });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(
        batchId
          ? `${res.assigned ?? 0} ta trek reysga biriktirildi`
          : `${res.assigned ?? 0} ta trek reysdan chiqarildi`,
      );
      onOpenChange(false);
      onDone?.();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex flex-col gap-4">
        <SheetHeader>
          <SheetTitle>Reysga biriktirish</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-1.5">
          <Label>Reys</Label>
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {batches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.label}
                </SelectItem>
              ))}
              <SelectItem value={NONE}>— Reysdan chiqarish</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border border-[#dfe4f2] bg-[#f3f5fb] px-3 py-2.5 text-[13px] text-slate-700">
          <b>{trackIds.length} ta trek</b> tanlandi.
        </div>

        <div className="flex gap-2.5">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Bekor qilish
          </Button>
          <Button className="flex-1" onClick={confirm} disabled={isPending}>
            {isPending ? 'Saqlanmoqda…' : 'Tasdiqlash'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

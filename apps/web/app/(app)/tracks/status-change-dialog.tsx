'use client';

import { useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';

import {
  STATUS_META,
  TRACK_STATUSES,
  shouldEnqueueNotification,
  type TrackStatus,
} from '@kargotrack/shared';

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

export interface StatusTarget {
  id: string;
  currentStatus: TrackStatus;
  customerId: string | null;
}

/**
 * Bottom-sheet status changer (design screens 03/04, 05). Works for one track
 * or many. Shows the live "{N} ta trek, {M} ta mijozga xabar yuboriladi" line by
 * reusing the shared `shouldEnqueueNotification` rule against the targets.
 */
export function StatusChangeDialog({
  targets,
  open,
  onOpenChange,
  defaultStatus = 'TASHKENT_WAREHOUSE',
  onDone,
}: {
  targets: StatusTarget[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStatus?: TrackStatus;
  onDone?: () => void;
}) {
  const [status, setStatus] = useState<TrackStatus>(defaultStatus);
  const [isPending, startTransition] = useTransition();

  const notifyCount = useMemo(() => {
    const custs = new Set<string>();
    for (const t of targets) {
      if (
        t.customerId &&
        shouldEnqueueNotification({
          previousStatus: t.currentStatus,
          newStatus: status,
          customerId: t.customerId,
        })
      ) {
        custs.add(t.customerId);
      }
    }
    return custs.size;
  }, [targets, status]);

  function confirm() {
    const trackIds = targets.map((t) => t.id);
    startTransition(async () => {
      // Imported lazily to keep the server action out of the initial chunk.
      const { changeTrackStatusesAction } = await import('./actions');
      const res = await changeTrackStatusesAction({ trackIds, status });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `${res.changed ?? 0} ta trek yangilandi` +
          (res.queued ? ` · ${res.queued} ta xabar navbatga qo'yildi` : ''),
      );
      onOpenChange(false);
      onDone?.();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex flex-col gap-4">
        <SheetHeader>
          <SheetTitle>Status o&apos;zgartirish</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-1.5">
          <Label>Yangi status</Label>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as TrackStatus)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRACK_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_META[s].emoji} {STATUS_META[s].uz}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-[#dfe4f2] bg-[#f3f5fb] px-3 py-2.5">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          <p className="text-[13px] leading-snug text-slate-700">
            <b>{targets.length} ta trek</b>
            {notifyCount > 0 ? (
              <>
                , <b>{notifyCount} ta mijozga</b> xabar yuboriladi
              </>
            ) : (
              <> — xabar yuborilmaydi</>
            )}
          </p>
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

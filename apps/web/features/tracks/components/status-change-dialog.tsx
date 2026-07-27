'use client';

import { useMemo, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  TRACK_STATUSES,
  shouldEnqueueNotification,
  type Lang,
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
import { Spinner } from '@/components/ui/spinner';
import { statusOptionLabel } from '@/lib/status-ui';

export interface StatusTarget {
  id: string;
  currentStatus: TrackStatus;
  customerId: string | null;
}

/**
 * Bottom-sheet status changer (design screens 03/04, 05). Works for one track
 * or many. Shows the live "N tracks, M customers notified" line by reusing the
 * shared `shouldEnqueueNotification` rule against the targets — the same
 * predicate the server applies, so the preview cannot disagree with the result.
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
  /** Called with the affected ids so the caller can paint them optimistically. */
  onDone?: (trackIds: string[], status: TrackStatus) => void;
}) {
  const t = useTranslations('tracks');
  const tCommon = useTranslations('common');
  const locale = useLocale() as Lang;
  const [status, setStatus] = useState<TrackStatus>(defaultStatus);
  const [isPending, startTransition] = useTransition();

  const notifyCount = useMemo(() => {
    const custs = new Set<string>();
    for (const target of targets) {
      if (
        target.customerId &&
        shouldEnqueueNotification({
          previousStatus: target.currentStatus,
          newStatus: status,
          customerId: target.customerId,
        })
      ) {
        custs.add(target.customerId);
      }
    }
    return custs.size;
  }, [targets, status]);

  function confirm() {
    const trackIds = targets.map((target) => target.id);
    startTransition(async () => {
      // Imported lazily to keep the server action out of the initial chunk.
      const { changeTrackStatusesAction } = await import('../actions');
      const res = await changeTrackStatusesAction({ trackIds, status });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(
        [
          t('statusChanged', { count: res.changed ?? 0 }),
          res.queued ? t('messagesQueued', { count: res.queued }) : null,
        ]
          .filter(Boolean)
          .join(' · '),
      );
      onOpenChange(false);
      onDone?.(trackIds, status);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex flex-col gap-4">
        <SheetHeader>
          <SheetTitle>{t('statusDialogTitle')}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-status">{t('newStatus')}</Label>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as TrackStatus)}
          >
            <SelectTrigger id="new-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRACK_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {statusOptionLabel(s, locale)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div
          // `aria-live`: the notification count changes as the status select
          // changes, and "who gets messaged" is the consequential half of this
          // dialog — a screen-reader user must hear it move, not re-read it.
          aria-live="polite"
          className="flex items-start gap-2 rounded-lg border border-[#dfe4f2] bg-[#f3f5fb] px-3 py-2.5"
        >
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          <p className="text-[13px] leading-snug text-slate-700">
            <b>{t('trackCount', { count: targets.length })}</b>
            {notifyCount > 0 ? (
              <>, {t('willNotify', { count: notifyCount })}</>
            ) : (
              <> — {t('willNotNotify')}</>
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

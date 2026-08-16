'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  BATCH_STATUSES,
  planBatchPropagation,
  type BatchStatus,
  type Lang,
  type TrackStatus,
} from '@kargotrack/shared';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionCard } from '@/components/ui/section-card';
import { Spinner } from '@/components/ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { statusOptionLabel } from '@/lib/status-ui';

import { changeBatchStatusAction, updateBatchEtaAction } from '../actions';

export interface MemberInfo {
  id: string;
  currentStatus: TrackStatus;
  customerId: string | null;
}

/** Batch detail controls (SPEC §5.7): editable ETA + status change w/ confirm. */
export function BatchControls({
  batchId,
  initialStatus,
  initialEta,
  members,
}: {
  batchId: string;
  initialStatus: BatchStatus;
  initialEta: string;
  members: MemberInfo[];
}) {
  const t = useTranslations('batches');
  const tCommon = useTranslations('common');
  // The "N tracks updated · M messages queued" result reads identically here
  // and in the tracks bulk bar, so it shares the `tracks` keys rather than
  // getting a second copy that would drift.
  const tTracks = useTranslations('tracks');
  const locale = useLocale() as Lang;
  const router = useRouter();

  const [eta, setEta] = useState(initialEta);
  const [status, setStatus] = useState<BatchStatus>(initialStatus);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [savingEta, startEta] = useTransition();
  const [applying, startApply] = useTransition();

  // Preview counts via the same planner the server uses (§7.10).
  const { changeCount, notifyCount } = useMemo(() => {
    const plan = planBatchPropagation(
      status,
      members.map((m) => ({
        id: m.id,
        currentStatus: m.currentStatus,
        customerId: m.customerId,
        deletedAt: null,
      })),
    );
    const custs = new Set<string>();
    for (const u of plan.updates) {
      if (u.willNotify && u.customerId) custs.add(u.customerId);
    }
    return { changeCount: plan.updates.length, notifyCount: custs.size };
  }, [status, members]);

  function saveEta() {
    startEta(async () => {
      const res = await updateBatchEtaAction({ batchId, etaDate: eta || null });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t('etaSaved'));
      router.refresh();
    });
  }

  function applyStatus() {
    startApply(async () => {
      const res = await changeBatchStatusAction({ batchId, status });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(
        [
          tTracks('statusChanged', { count: res.changed ?? 0 }),
          res.queued ? tTracks('messagesQueued', { count: res.queued }) : null,
        ]
          .filter(Boolean)
          .join(' · '),
      );
      setConfirmOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {/* ETA */}
      <SectionCard>
        <Label htmlFor="eta" className="mb-1.5 block">
          {t('etaLong')}
        </Label>
        <div className="flex gap-2">
          <Input
            id="eta"
            type="date"
            value={eta}
            onChange={(e) => setEta(e.target.value)}
            className="flex-1"
          />
          <Button variant="secondary" onClick={saveEta} disabled={savingEta}>
            {savingEta ? <Spinner /> : null}
            {tCommon('save')}
          </Button>
        </div>
      </SectionCard>

      {/* Status */}
      <SectionCard className="space-y-2.5">
        <Label htmlFor="batch-status">{t('status')}</Label>
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as BatchStatus)}
        >
          <SelectTrigger id="batch-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BATCH_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {statusOptionLabel(s, locale)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button className="w-full" onClick={() => setConfirmOpen(true)}>
          {t('applyStatus')}
        </Button>
      </SectionCard>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('confirmTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-small leading-snug text-ink-2">
            {t('confirmBody', { count: changeCount })}
            {notifyCount > 0 ? (
              <>, {t('confirmNotify', { count: notifyCount })}</>
            ) : (
              <> — {t('confirmNoNotify')}</>
            )}
            .
          </p>
          <p className="text-micro text-muted-foreground">
            {t('confirmTerminalNote')}
          </p>
          <DialogFooter>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setConfirmOpen(false)}
              disabled={applying}
            >
              {tCommon('cancel')}
            </Button>
            <Button className="flex-1" onClick={applyStatus} disabled={applying}>
              {applying ? <Spinner /> : null}
              {tCommon('confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

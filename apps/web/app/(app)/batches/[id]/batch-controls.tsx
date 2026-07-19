'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';

import {
  BATCH_STATUSES,
  STATUS_META,
  planBatchPropagation,
  type BatchStatus,
  type TrackStatus,
} from '@kargotrack/shared';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
    for (const u of plan.updates) if (u.willNotify && u.customerId) custs.add(u.customerId);
    return { changeCount: plan.updates.length, notifyCount: custs.size };
  }, [status, members]);

  function saveEta() {
    startEta(async () => {
      const res = await updateBatchEtaAction({ batchId, etaDate: eta || null });
      if (res.error) toast.error(res.error);
      else {
        toast.success('ETA saqlandi');
        router.refresh();
      }
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
        `${res.changed ?? 0} ta trek yangilandi` +
          (res.queued ? ` · ${res.queued} ta xabar navbatga qo'yildi` : ''),
      );
      setConfirmOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {/* ETA */}
      <div className="rounded-xl border border-border bg-white p-3.5">
        <Label htmlFor="eta" className="mb-1.5 block">
          ETA (taxminiy yetib kelish)
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
            {savingEta ? '…' : 'Saqlash'}
          </Button>
        </div>
      </div>

      {/* Status */}
      <div className="space-y-2.5 rounded-xl border border-border bg-white p-3.5">
        <Label>Reys statusi</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as BatchStatus)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BATCH_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_META[s].emoji} {STATUS_META[s].uz}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button className="w-full" onClick={() => setConfirmOpen(true)}>
          Statusni qo&apos;llash
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reys statusini o&apos;zgartirish</DialogTitle>
          </DialogHeader>
          <p className="text-[13.5px] leading-snug text-slate-700">
            <b>{changeCount} ta trekka</b> qo&apos;llanadi
            {notifyCount > 0 ? (
              <>
                , <b>{notifyCount} ta mijozga</b> xabar ketadi
              </>
            ) : (
              <> — xabar yuborilmaydi</>
            )}
            .
          </p>
          <p className="text-[12px] text-muted-foreground">
            Yakunlangan (Topshirildi / Yo&apos;qolgan / Qaytarildi) treklar
            o&apos;zgarmaydi.
          </p>
          <DialogFooter>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setConfirmOpen(false)}
              disabled={applying}
            >
              Bekor qilish
            </Button>
            <Button className="flex-1" onClick={applyStatus} disabled={applying}>
              {applying ? 'Saqlanmoqda…' : 'Tasdiqlash'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

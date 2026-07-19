'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import type { TrackStatus } from '@kargotrack/shared';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { StatusChangeDialog } from '../status-change-dialog';
import { softDeleteTrackAction } from '../actions';

/** Status-change + soft-delete controls on the track detail page (SPEC §5.3). */
export function TrackActions({
  trackId,
  code,
  currentStatus,
  customerId,
}: {
  trackId: string;
  code: string;
  currentStatus: TrackStatus;
  customerId: string | null;
}) {
  const router = useRouter();
  const [statusOpen, setStatusOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, startDelete] = useTransition();

  function onDelete() {
    startDelete(async () => {
      const res = await softDeleteTrackAction(trackId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Trek o‘chirildi');
      setDeleteOpen(false);
      router.push('/tracks');
      router.refresh();
    });
  }

  return (
    <div className="flex gap-2.5">
      <Button className="flex-1" onClick={() => setStatusOpen(true)}>
        Status o&apos;zgartirish
      </Button>
      <Button
        variant="destructive"
        size="icon"
        aria-label="O'chirish"
        onClick={() => setDeleteOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      <StatusChangeDialog
        targets={[{ id: trackId, currentStatus, customerId }]}
        open={statusOpen}
        onOpenChange={setStatusOpen}
        defaultStatus={currentStatus}
        onDone={() => router.refresh()}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trekni o&apos;chirish</DialogTitle>
            <DialogDescription>
              <span className="font-mono font-semibold">{code}</span> o&apos;chiriladi.
              Bu amalni qaytarib bo&apos;lmaydi.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setDeleteOpen(false)}
              disabled={isDeleting}
            >
              Bekor qilish
            </Button>
            <Button
              variant="destructive"
              className="flex-1 border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={onDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'O‘chirilmoqda…' : "O'chirish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

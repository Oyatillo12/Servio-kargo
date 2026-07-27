'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
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
import { Spinner } from '@/components/ui/spinner';

import { StatusChangeDialog } from './status-change-dialog';
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
  const t = useTranslations('trackDetail');
  const tTracks = useTranslations('tracks');
  const tCommon = useTranslations('common');
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
      toast.success(t('deleted'));
      setDeleteOpen(false);
      router.push('/tracks');
      router.refresh();
    });
  }

  return (
    <div className="flex gap-2.5">
      <Button className="flex-1" onClick={() => setStatusOpen(true)}>
        {tTracks('bulkChangeStatus')}
      </Button>
      <Button
        variant="destructive"
        size="icon"
        aria-label={tCommon('delete')}
        onClick={() => setDeleteOpen(true)}
      >
        <Trash2 className="h-4 w-4" aria-hidden />
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
            <DialogTitle>{t('deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('deleteBody', { code })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setDeleteOpen(false)}
              disabled={isDeleting}
            >
              {tCommon('cancel')}
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={onDelete}
              disabled={isDeleting}
            >
              {isDeleting ? <Spinner /> : null}
              {tCommon('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

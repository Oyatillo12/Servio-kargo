'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Trash2 } from 'lucide-react';
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
import { SectionCard } from '@/components/ui/section-card';
import { Spinner } from '@/components/ui/spinner';

/** SPEC §8: warehouse photos are JPEG, max 10 MB — the same rule as the bot. */
const MAX_PHOTO_MB = 10;
const MAX_PHOTO_BYTES = MAX_PHOTO_MB * 1024 * 1024;

/**
 * The track detail's photo card (tasks.md A5): view + upload/replace + delete
 * from the office, against the same `/api/tracks/[id]/photo` endpoint the
 * /weigh console uses (W4) — one photo per parcel whichever surface took it.
 * `canEdit` mirrors the endpoint's `tracks.weigh` gate; hiding the buttons is a
 * courtesy, the route re-checks (CLAUDE.md rule 9).
 */
export function PhotoCard({
  trackId,
  code,
  hasPhoto: initialHasPhoto,
  canEdit,
}: {
  trackId: string;
  code: string;
  hasPhoto: boolean;
  canEdit: boolean;
}) {
  const t = useTranslations('trackDetail');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [hasPhoto, setHasPhoto] = useState(initialHasPhoto);
  // Bumped after every upload so the <img> bypasses the 60s HTTP cache and
  // shows the replacement immediately.
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, startDelete] = useTransition();

  async function onFileChosen(file: File) {
    // Checked here as well as on the server so a too-big shot is refused
    // instantly instead of after the upload.
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error(t('photoTooLarge', { max: MAX_PHOTO_MB }));
      return;
    }

    const body = new FormData();
    body.append('photo', file);

    setBusy(true);
    try {
      const res = await fetch(`/api/tracks/${trackId}/photo`, {
        method: 'POST',
        body,
      });
      if (!res.ok) {
        const code = await res
          .json()
          .then((j: { error?: string }) => j.error)
          .catch(() => undefined);
        toast.error(photoErrorText(code));
        return;
      }
      setHasPhoto(true);
      setVersion((v) => v + 1);
      toast.success(t('photoUploaded'));
      router.refresh();
    } catch {
      toast.error(t('photoFailed'));
    } finally {
      setBusy(false);
    }
  }

  function photoErrorText(code: string | undefined): string {
    if (code === 'TOO_LARGE') return t('photoTooLarge', { max: MAX_PHOTO_MB });
    if (code === 'BAD_TYPE') return t('photoBadType');
    return t('photoFailed');
  }

  function onDelete() {
    startDelete(async () => {
      try {
        const res = await fetch(`/api/tracks/${trackId}/photo`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          toast.error(t('photoFailed'));
          return;
        }
        setHasPhoto(false);
        setDeleteOpen(false);
        toast.success(t('photoDeleted'));
        router.refresh();
      } catch {
        toast.error(t('photoFailed'));
      }
    });
  }

  return (
    <SectionCard
      title={t('photo')}
      action={
        canEdit ? (
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? <Spinner /> : <Camera className="h-4 w-4" aria-hidden />}
              {hasPhoto ? t('photoReplace') : t('photoUpload')}
            </Button>
            {hasPhoto ? (
              <Button
                variant="outline"
                size="sm"
                aria-label={t('photoDelete')}
                disabled={busy}
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            ) : null}
          </div>
        ) : undefined
      }
    >
      {hasPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/tracks/${trackId}/photo${version ? `?v=${version}` : ''}`}
          alt={t('photoAlt', { code })}
          className="max-h-80 w-auto rounded-lg border border-border"
        />
      ) : (
        <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-input text-sm text-muted-foreground">
          {t('noPhoto')}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Cleared so re-picking the same file fires `change` again.
          e.target.value = '';
          if (file) void onFileChosen(file);
        }}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('photoDeleteTitle')}</DialogTitle>
            <DialogDescription>{t('photoDeleteBody')}</DialogDescription>
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
              {t('photoDelete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}

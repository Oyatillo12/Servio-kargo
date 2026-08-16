'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { formatDateTime } from '@kargotrack/shared';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SectionCard } from '@/components/ui/section-card';
import { Spinner } from '@/components/ui/spinner';

/** SPEC §8: warehouse photos are JPEG, max 10 MB — the same rule as the bot. */
const MAX_PHOTO_MB = 10;
const MAX_PHOTO_BYTES = MAX_PHOTO_MB * 1024 * 1024;

const KINDS = ['intake', 'damage', 'handover'] as const;
export type PhotoKind = (typeof KINDS)[number];

export interface TrackPhotoView {
  id: string;
  kind: PhotoKind;
  createdAt: Date;
}

/**
 * The track detail's photo gallery (SPEC §7.14, tasks.md H2): every photo with
 * its kind badge and date; upload with a kind choice, per-photo delete.
 * `canEdit` mirrors the endpoints' `tracks.weigh` gate; hiding the buttons is
 * a courtesy, the routes re-check (CLAUDE.md rule 9).
 */
export function PhotoCard({
  trackId,
  code,
  photos,
  canEdit,
}: {
  trackId: string;
  code: string;
  photos: TrackPhotoView[];
  canEdit: boolean;
}) {
  const t = useTranslations('trackDetail');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<PhotoKind>('intake');
  const [busy, setBusy] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, startDelete] = useTransition();

  const kindLabels: Record<PhotoKind, string> = {
    intake: t('photoKind_intake'),
    damage: t('photoKind_damage'),
    handover: t('photoKind_handover'),
  };

  async function onFileChosen(file: File) {
    // Checked here as well as on the server so a too-big shot is refused
    // instantly instead of after the upload.
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error(t('photoTooLarge', { max: MAX_PHOTO_MB }));
      return;
    }

    const body = new FormData();
    body.append('photo', file);
    body.append('kind', kind);

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

  function onDelete(photoId: string) {
    startDelete(async () => {
      try {
        const res = await fetch(`/api/tracks/${trackId}/photo/${photoId}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          toast.error(t('photoFailed'));
          return;
        }
        setDeleteId(null);
        toast.success(t('photoDeleted'));
        router.refresh();
      } catch {
        toast.error(t('photoFailed'));
      }
    });
  }

  return (
    <SectionCard
      title={
        photos.length > 0 ? `${t('photo')} · ${photos.length}` : t('photo')
      }
      action={
        canEdit ? (
          <div className="flex items-center gap-1.5">
            <Select value={kind} onValueChange={(v) => setKind(v as PhotoKind)}>
              <SelectTrigger className="h-8 w-auto gap-1 text-micro">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {kindLabels[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? <Spinner /> : <Camera className="h-4 w-4" aria-hidden />}
              {t('photoUpload')}
            </Button>
          </div>
        ) : undefined
      }
    >
      {photos.length > 0 ? (
        <ul className="space-y-3">
          {photos.map((p) => (
            <li key={p.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/tracks/${trackId}/photo/${p.id}`}
                alt={t('photoAlt', { code })}
                className="max-h-80 w-auto rounded-lg border border-border"
              />
              <div className="mt-1 flex items-center gap-2">
                <span className="rounded-full bg-accent px-2 py-0.5 text-micro font-semibold text-ink-2">
                  {kindLabels[p.kind]}
                </span>
                <span className="font-mono text-micro text-muted-foreground">
                  {formatDateTime(p.createdAt)}
                </span>
                {canEdit ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-7 px-2"
                    aria-label={t('photoDelete')}
                    disabled={busy}
                    onClick={() => setDeleteId(p.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
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

      <Dialog
        open={deleteId != null}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('photoDeleteTitle')}</DialogTitle>
            <DialogDescription>{t('photoDeleteBody')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setDeleteId(null)}
              disabled={isDeleting}
            >
              {tCommon('cancel')}
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => deleteId && onDelete(deleteId)}
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

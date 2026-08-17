'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionCard } from '@/components/ui/section-card';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';

import { updateTrackMetaAction } from '../detail-actions';

/**
 * The track's metadata card (SPEC §5.3, §7.13): marka (what the box says),
 * tavsif (what the parcel is), izoh (internal note). View for everyone with
 * `tracks.view`; the pencil appears only with `tracks.edit` — and the Server
 * Action re-checks (rule 9). The panel edit is the one surface that may CLEAR
 * a field; weighing and import only ever fill.
 */
export function MetaCard({
  trackId,
  marka,
  description,
  note,
  canEdit,
}: {
  trackId: string;
  marka: string | null;
  description: string | null;
  note: string | null;
  canEdit: boolean;
}) {
  const t = useTranslations('trackDetail');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [draftMarka, setDraftMarka] = useState(marka ?? '');
  const [draftDescription, setDraftDescription] = useState(description ?? '');
  const [draftNote, setDraftNote] = useState(note ?? '');
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await updateTrackMetaAction({
        trackId,
        marka: draftMarka,
        description: draftDescription,
        note: draftNote,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t('metaSaved'));
      setEditing(false);
      router.refresh();
    });
  }

  const empty = marka == null && description == null && note == null;
  // Nothing set and nobody here can change that — an empty card explains
  // nothing, so don't draw it.
  if (empty && !canEdit) return null;

  return (
    <SectionCard
      title={t('metaTitle')}
      action={
        canEdit && !editing ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraftMarka(marka ?? '');
              setDraftDescription(description ?? '');
              setDraftNote(note ?? '');
              setEditing(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            {tCommon('edit')}
          </Button>
        ) : undefined
      }
    >
      {editing ? (
        <div className="space-y-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="meta-marka">{t('metaMarka')}</Label>
            <Input
              id="meta-marka"
              value={draftMarka}
              maxLength={32}
              onChange={(e) => setDraftMarka(e.target.value)}
              className="font-mono"
              placeholder="DK-1042"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="meta-description">{t('metaDescription')}</Label>
            <Input
              id="meta-description"
              value={draftDescription}
              maxLength={200}
              onChange={(e) => setDraftDescription(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="meta-note">{t('metaNote')}</Label>
            <Textarea
              id="meta-note"
              value={draftNote}
              maxLength={500}
              rows={3}
              onChange={(e) => setDraftNote(e.target.value)}
            />
            <p className="text-micro text-muted-foreground">
              {t('metaNoteHint')}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={isPending} onClick={save}>
              {isPending ? <Spinner /> : null}
              {tCommon('save')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => setEditing(false)}
            >
              {tCommon('cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <dl className="space-y-2 text-small">
          <MetaRow label={t('metaMarka')} value={marka} mono />
          <MetaRow label={t('metaDescription')} value={description} />
          <MetaRow label={t('metaNote')} value={note} />
        </dl>
      )}
    </SectionCard>
  );
}

function MetaRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  const tCommon = useTranslations('common');
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="flex-none text-muted-foreground">{label}</dt>
      <dd
        className={`min-w-0 whitespace-pre-wrap break-words text-right ${
          mono ? 'font-mono ' : ''
        }${value ? 'text-foreground' : 'text-muted-foreground'}`}
      >
        {value ?? tCommon('dash')}
      </dd>
    </div>
  );
}

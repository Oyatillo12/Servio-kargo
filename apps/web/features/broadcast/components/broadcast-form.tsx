'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { BROADCAST_MAX_CHARS } from '@kargotrack/shared';

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
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/** Warn from 90% of the limit — enough runway to still edit the message down. */
const WARN_AT = Math.floor(BROADCAST_MAX_CHARS * 0.9);

/**
 * Compose → preview recipient count → confirm → queue (SPEC §5.8). The
 * recipient count is passed from the server page (reachable customers).
 */
export function BroadcastForm({ recipientCount }: { recipientCount: number }) {
  const t = useTranslations('broadcast');
  const tCommon = useTranslations('common');
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const trimmed = text.trim();
  const canSend = trimmed.length > 0 && recipientCount > 0;

  function send() {
    startTransition(async () => {
      const { sendBroadcastAction } = await import('../actions');
      const res = await sendBroadcastAction(text);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t('sent', { count: res.count ?? 0 }));
      setText('');
      setOpen(false);
    });
  }

  return (
    <SectionCard className="space-y-3">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={BROADCAST_MAX_CHARS}
        rows={7}
        placeholder={t('placeholder')}
        aria-label={t('pageTitle')}
      />
      <div className="flex items-center justify-between text-[12px] text-muted-foreground">
        <span>{t('recipients', { count: recipientCount })}</span>
        <span
          className={cn(
            'font-mono tabular-nums',
            text.length >= WARN_AT && 'font-semibold text-[#b3261e]',
          )}
        >
          {text.length}/{BROADCAST_MAX_CHARS}
        </span>
      </div>
      <Button
        className="w-full"
        disabled={!canSend || pending}
        onClick={() => setOpen(true)}
      >
        {tCommon('send')}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('confirmTitle')}</DialogTitle>
            <DialogDescription>
              {t('confirmBody', { count: recipientCount })}
            </DialogDescription>
          </DialogHeader>
          {/* The exact text, re-read before it becomes unrecallable: once
              queued, a broadcast lands in every customer's chat. */}
          <div className="max-h-52 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-secondary/40 p-3 text-[13px]">
            {trimmed}
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              {tCommon('cancel')}
            </Button>
            <Button className="flex-1" onClick={send} disabled={pending}>
              {pending ? <Spinner /> : null}
              {tCommon('send')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}

'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Send, StopCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  BROADCAST_HOLD_SECONDS,
  BROADCAST_MAX_CHARS,
} from '@kargotrack/shared';

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
export function BroadcastForm({
  recipientCount,
  canTest,
}: {
  recipientCount: number;
  /** The signed-in employee has a linked Telegram chat (§5.8, K1). */
  canTest: boolean;
}) {
  const t = useTranslations('broadcast');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  /**
   * The broadcast just queued, while it can still be called back (§5.8).
   * `secondsLeft` counts the hold window down; at zero the control stops
   * meaning "nobody got it" and starts meaning "the rest won't go".
   */
  const [held, setHeld] = useState<{ id: string; count: number } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!held || secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [held, secondsLeft]);

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
      toast.success(t('queued', { count: res.count ?? 0 }));
      setText('');
      setOpen(false);
      if (res.broadcastId) {
        setHeld({ id: res.broadcastId, count: res.count ?? 0 });
        setSecondsLeft(BROADCAST_HOLD_SECONDS);
      }
      router.refresh();
    });
  }

  function sendTest() {
    startTransition(async () => {
      const { sendBroadcastTestAction } = await import('../actions');
      const res = await sendBroadcastTestAction(text);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t('testQueued'));
    });
  }

  function stop() {
    if (!held) return;
    startTransition(async () => {
      const { cancelBroadcastAction } = await import('../actions');
      const res = await cancelBroadcastAction(held.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      // Whether it reached nobody or stopped partway is what the window was
      // for; the toast says which, because the difference matters afterwards.
      toast.success(secondsLeft > 0 ? t('cancelledInTime') : t('stopped'));
      setHeld(null);
      router.refresh();
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
      {/* K1: see it in your own chat before three thousand people do. */}
      <Button
        variant="secondary"
        className="w-full"
        disabled={trimmed.length === 0 || !canTest || pending}
        onClick={sendTest}
        title={canTest ? undefined : t('testNoTelegram')}
      >
        <Send aria-hidden />
        {t('testSend')}
      </Button>
      {canTest ? null : (
        <p className="-mt-1 text-[11.5px] text-muted-foreground">
          {t('testNoTelegram')}
        </p>
      )}

      <Button
        className="w-full"
        disabled={!canSend || pending}
        onClick={() => setOpen(true)}
      >
        {tCommon('send')}
      </Button>

      {/* The hold window (§5.8, D-008). Deliberately loud and deliberately
          in the way: this is the last moment the message is recallable. */}
      {held ? (
        <div className="rounded-xl border border-primary/30 bg-accent px-3.5 py-3">
          <p className="text-[13px] font-semibold text-foreground">
            {secondsLeft > 0
              ? t('holdCountdown', { seconds: secondsLeft, count: held.count })
              : t('holdSending', { count: held.count })}
          </p>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
            {secondsLeft > 0 ? t('holdHint') : t('stopHint')}
          </p>
          <div className="mt-2.5 flex gap-2">
            <Button
              variant="destructive"
              className="flex-1"
              onClick={stop}
              disabled={pending}
            >
              <StopCircle aria-hidden />
              {secondsLeft > 0 ? tCommon('cancel') : t('stop')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setHeld(null)}
              disabled={pending}
            >
              {tCommon('close')}
            </Button>
          </div>
        </div>
      ) : null}

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

'use client';

import { useState, useTransition } from 'react';
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

import { sendBroadcastAction } from './actions';

/**
 * Compose → preview recipient count → confirm → queue (SPEC §5.8). The
 * recipient count is passed from the server page (reachable customers).
 */
export function BroadcastForm({ recipientCount }: { recipientCount: number }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const trimmed = text.trim();
  const canSend = trimmed.length > 0 && recipientCount > 0;

  function send() {
    startTransition(async () => {
      const res = await sendBroadcastAction(text);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`${res.count ?? 0} ta mijozga yuborildi`);
      setText('');
      setOpen(false);
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-white p-3.5">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={BROADCAST_MAX_CHARS}
        rows={7}
        placeholder="Barcha mijozlarga yuboriladigan xabar…"
        className="w-full resize-y rounded-lg border border-input bg-white px-3 py-2.5 text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="flex items-center justify-between text-[12px] text-muted-foreground">
        <span>
          <b className="font-semibold text-foreground">{recipientCount}</b> ta
          mijozga yuboriladi
        </span>
        <span className="font-mono">
          {text.length}/{BROADCAST_MAX_CHARS}
        </span>
      </div>
      <Button
        className="w-full"
        disabled={!canSend || pending}
        onClick={() => setOpen(true)}
      >
        Yuborish
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xabarnoma yuborish</DialogTitle>
            <DialogDescription>
              <b>{recipientCount} ta mijozga</b> quyidagi xabar yuboriladi.
              Davom etamizmi?
            </DialogDescription>
          </DialogHeader>
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
              Bekor qilish
            </Button>
            <Button className="flex-1" onClick={send} disabled={pending}>
              {pending ? 'Yuborilmoqda…' : 'Yuborish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { TICKET_TEXT_MAX } from '@kargotrack/shared';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';

import { replyTicketAction } from '../actions';

/**
 * The §5.16 reply box. Sending saves the staff message and queues the bot
 * delivery; the thread above re-renders with the new bubble and its delivery
 * outcome appears once the worker has spoken (H4).
 */
export function TicketReplyForm({ ticketId }: { ticketId: string }) {
  const t = useTranslations('tickets');
  const router = useRouter();
  const [text, setText] = useState('');
  const [isPending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await replyTicketAction({ ticketId, text });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setText('');
      toast.success(t('replySent'));
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={text}
        rows={3}
        maxLength={TICKET_TEXT_MAX}
        placeholder={t('replyPlaceholder')}
        onChange={(e) => setText(e.target.value)}
      />
      <Button
        className="w-full"
        disabled={isPending || text.trim() === ''}
        onClick={submit}
      >
        {isPending ? <Spinner /> : <Send className="h-4 w-4" aria-hidden />}
        {t('replySend')}
      </Button>
    </div>
  );
}

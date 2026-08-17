'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { StopCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Spinner } from '@/components/ui/spinner';

/**
 * Stop a fan-out from the history list (SPEC §5.8, §7.11).
 *
 * The compose screen has its own countdown banner, but that state dies with
 * the page — and a broadcast to three thousand people outlives one browser
 * tab. This is the same action reachable after a reload, which is exactly when
 * somebody realises what they sent.
 */
export function StopBroadcastButton({ broadcastId }: { broadcastId: string }) {
  const t = useTranslations('broadcast');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function stop() {
    startTransition(async () => {
      const { cancelBroadcastAction } = await import('../actions');
      const res = await cancelBroadcastAction(broadcastId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t('stopped'));
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={stop}
      disabled={pending}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-micro font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
    >
      {pending ? (
        <Spinner className="h-3.5 w-3.5" />
      ) : (
        <StopCircle className="h-3.5 w-3.5" aria-hidden />
      )}
      {t('stop')}
    </button>
  );
}

'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { reportClientErrorAction } from '@/lib/report-error';

/**
 * Route error boundary (AUDIT.md T5). Before this existed an admin hit Next's
 * default English error screen and nothing was recorded — the failure was
 * invisible unless they phoned. Now they get an Uzbek page with a retry, and the
 * error is reported with its route and digest.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    // Fire-and-forget: reporting must never block or replace the error UI.
    void reportClientErrorAction({
      message: error.message,
      digest: error.digest,
      pathname,
    }).catch(() => {});
  }, [error, pathname]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--st-lost-bg)] text-2xl">
        ⚠️
      </div>
      <div>
        <p className="text-lg font-bold text-foreground">Xatolik yuz berdi</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Sahifani qayta yuklab ko&apos;ring. Takrorlansa, biz bilan
          bog&apos;laning.
        </p>
      </div>
      <Button onClick={reset}>
        <RotateCcw className="h-4 w-4" />
        Qayta urinish
      </Button>
      {error.digest ? (
        <p className="font-mono text-micro text-muted-foreground">
          Kod: {error.digest}
        </p>
      ) : null}
    </div>
  );
}

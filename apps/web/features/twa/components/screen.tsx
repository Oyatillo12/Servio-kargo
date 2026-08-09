import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';

import { TelegramBack } from './back-button';

/**
 * Standard sub-screen chrome: Telegram's native BackButton does the real
 * navigation; the small in-page link is the fallback for old clients and
 * plain browsers.
 */
export function Screen({
  title,
  backHref,
  backLabel,
  action,
  children,
}: {
  title: string;
  backHref?: string;
  backLabel?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3">
      {backHref ? <TelegramBack href={backHref} /> : null}
      <header className="twa-rise flex items-center justify-between gap-3">
        <div className="min-w-0">
          {backHref && backLabel ? (
            <Link
              href={backHref}
              className="twa-hint -ml-1 mb-0.5 inline-flex items-center gap-0.5 text-[12.5px]"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
              {backLabel}
            </Link>
          ) : null}
          <h1 className="truncate text-[19px] font-extrabold leading-tight">
            {title}
          </h1>
        </div>
        {action ? <div className="flex-none">{action}</div> : null}
      </header>
      {children}
    </div>
  );
}

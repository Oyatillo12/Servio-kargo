'use client';

import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

/**
 * The chrome around the landing nav: transparent on the paper at the top,
 * a white bar with a hairline rule once you scroll — the same move the
 * panel's top bar makes, not a floating pill.
 *
 * The only reason this is a client component. The nav itself stays server
 * -rendered and arrives as `children`, so no translation machinery is shipped
 * to the browser — this file adds one scroll listener and nothing else.
 */
export function HeaderShell({ children }: { children: React.ReactNode }) {
  const [detached, setDetached] = useState(false);

  useEffect(() => {
    // `passive` because the handler never calls preventDefault — without it
    // the browser must wait on us before it may scroll.
    const onScroll = () => setDetached(window.scrollY > 12);
    onScroll(); // a reload part-way down the page starts detached
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b transition-colors duration-200',
        detached
          ? 'border-rule bg-card/90 backdrop-blur-md'
          : 'border-transparent bg-transparent',
      )}
    >
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-5 sm:px-6">
        {children}
      </div>
    </header>
  );
}

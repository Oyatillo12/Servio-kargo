'use client';

import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

/**
 * The chrome around the landing nav: flush with the page at the top, a
 * detached rounded bar once you scroll.
 *
 * The only reason this is a client component. The nav itself stays server
 * -rendered and arrives as `children`, so no translation machinery is shipped
 * to the browser — this file adds one scroll listener and nothing else.
 *
 * The outer wrapper keeps a constant height in both states, so the transition
 * moves only the inner bar and never reflows the page under it.
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
    <header className="sticky top-0 z-40 px-3 py-2.5 sm:px-4">
      <div
        className={cn(
          'mx-auto flex h-14 items-center justify-between transition-all duration-300 ease-out',
          detached
            ? 'max-w-3xl rounded-full border border-[#E4E6EA] bg-white/85 pl-5 pr-2.5 shadow-[0_8px_28px_-10px_rgba(26,29,33,0.18)] backdrop-blur-md'
            : 'max-w-5xl rounded-full border border-transparent bg-transparent pl-2 pr-1 shadow-none',
        )}
      >
        {children}
      </div>
    </header>
  );
}

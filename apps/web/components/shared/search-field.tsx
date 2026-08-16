'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

const DEBOUNCE_MS = 300;

export interface SearchFieldProps {
  /** Route the results live on, e.g. `/tracks`. */
  path: string;
  /** Current `?q=` value from the server. */
  value: string;
  placeholder: string;
  /** Accessible name; also used as the clear button's label prefix. */
  label: string;
  /** Other filters to carry across a search (status, batch, worklist…). */
  keep?: Record<string, string | undefined>;
  className?: string;
}

/**
 * Instant search for the list screens (AUDIT.md T15).
 *
 * The panel previously wrapped the input in a plain `<form method="get">`, so
 * finding a customer meant type → Enter → full page reload, and a typo meant
 * doing it again. This navigates as you type, debounced, and keeps every other
 * active filter.
 *
 * Enter still submits immediately and without waiting out the debounce — that
 * path is not a convenience, it is the barcode-scanner workflow: the scanner
 * emits the code followed by a carriage return, and a warehouse operator
 * scanning a shelf of parcels must not be made to wait 300 ms per box.
 */
export function SearchField({
  path,
  value,
  placeholder,
  label,
  keep,
  className,
}: SearchFieldProps) {
  const t = useTranslations('common');
  const router = useRouter();
  const [term, setTerm] = useState(value);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // The server is the source of truth: adopt its value when the URL changes
  // underneath us (back button, a filter chip, a link from the dashboard).
  useEffect(() => setTerm(value), [value]);

  function hrefFor(next: string): string {
    const params = new URLSearchParams();
    for (const [key, v] of Object.entries(keep ?? {})) {
      if (v) params.set(key, v);
    }
    const trimmed = next.trim();
    if (trimmed) params.set('q', trimmed);
    const qs = params.toString();
    return qs ? `${path}?${qs}` : path;
  }

  function navigate(next: string) {
    // `replace`, not `push`: every keystroke would otherwise become its own
    // history entry and the back button would have to unwind the whole word.
    startTransition(() => router.replace(hrefFor(next), { scroll: false }));
  }

  // Debounced navigation. Skipped while the field already matches the URL, so
  // adopting a server value (above) does not bounce straight back out.
  useEffect(() => {
    if (term.trim() === value.trim()) return;
    const timer = setTimeout(() => navigate(term), DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  return (
    <div className={cn('relative flex-1', className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
        aria-hidden
      />
      <Input
        ref={inputRef}
        type="search"
        name="q"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            navigate(term);
          }
          if (e.key === 'Escape' && term) {
            e.preventDefault();
            setTerm('');
          }
        }}
        placeholder={placeholder}
        aria-label={label}
        // `pl-9` clears the magnifier, `pr-9` the spinner / clear button.
        className="h-control bg-surface-alt pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden"
      />
      <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center text-muted-foreground">
        {isPending ? (
          <Spinner className="h-4 w-4" />
        ) : term ? (
          <button
            type="button"
            aria-label={t('clearSearch')}
            onClick={() => {
              setTerm('');
              navigate('');
              inputRef.current?.focus();
            }}
            className="rounded p-0.5 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}

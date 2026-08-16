import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { cn } from '@/lib/utils';

/**
 * Prev / "3 / 12" / Next row for the paginated list screens.
 *
 * `buildHref` is supplied by the page so each list keeps ownership of which
 * query params survive a page change (search term, status, batch, worklist).
 */
export async function Pagination({
  page,
  pages,
  buildHref,
  className,
}: {
  page: number;
  pages: number;
  buildHref: (page: number) => string;
  className?: string;
}) {
  const t = await getTranslations('common');
  if (pages <= 1) return null;

  return (
    <nav
      aria-label={t('pageOf', { page, pages })}
      className={cn('mt-4 flex items-center justify-between gap-3 text-small', className)}
    >
      <PageLink
        href={buildHref(page - 1)}
        label={t('prevPage')}
        disabled={page <= 1}
        direction="prev"
      />
      <span className="font-mono text-muted-foreground" aria-current="page">
        {t('pageOf', { page, pages })}
      </span>
      <PageLink
        href={buildHref(page + 1)}
        label={t('nextPage')}
        disabled={page >= pages}
        direction="next"
      />
    </nav>
  );
}

function PageLink({
  href,
  label,
  disabled,
  direction,
}: {
  href: string;
  label: string;
  disabled: boolean;
  direction: 'prev' | 'next';
}) {
  const Icon = direction === 'prev' ? ChevronLeft : ChevronRight;
  const content = (
    <>
      {direction === 'prev' ? <Icon className="h-4 w-4" aria-hidden /> : null}
      {label}
      {direction === 'next' ? <Icon className="h-4 w-4" aria-hidden /> : null}
    </>
  );
  const shared =
    'inline-flex items-center gap-1 rounded-md border border-input px-3 py-1.5 font-medium';

  // Rendered as a disabled span rather than omitted: keeping both ends in the
  // DOM stops the page indicator from jumping sideways on the first/last page.
  if (disabled) {
    return (
      <span
        aria-disabled
        className={cn(shared, 'cursor-default bg-surface-alt text-faint')}
      >
        {content}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={cn(shared, 'bg-surface text-ink-2 transition-colors hover:bg-surface-alt')}
    >
      {content}
    </Link>
  );
}

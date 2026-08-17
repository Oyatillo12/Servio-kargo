import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Route-level loading placeholders (AUDIT.md T15).
 *
 * Only `/tracks` had a `loading.tsx`; every other screen showed the *previous*
 * page frozen until its queries returned, which on a phone connection reads as
 * a dead tap. These mirror the real layouts closely enough that nothing jumps
 * when the content lands.
 */

/** Title row + optional right-hand control. */
export function HeaderSkeleton({ withAction = true }: { withAction?: boolean }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <Skeleton className="h-6 w-36" />
      {withAction ? <Skeleton className="h-8 w-24 rounded-lg" /> : null}
    </div>
  );
}

/** Bordered card holding `rows` list lines. */
export function ListSkeleton({
  rows = 6,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-border bg-surface',
        className,
      )}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-b border-rule-soft px-4 py-3.5 last:border-0"
        >
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-2.5 w-24" />
          </div>
          <Skeleton className="h-4 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Stack of `cards` bordered blocks — the shape of the detail screens. */
export function CardsSkeleton({
  cards = 3,
  className,
}: {
  cards?: number;
  className?: string;
}) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="space-y-2.5 rounded-lg border border-border bg-surface p-3.5">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-2.5 w-2/3" />
        </div>
      ))}
    </div>
  );
}

/**
 * The record screens' shell while it loads (SPEC 5.0): back link, identity row,
 * optional rail, the tab strip, then the first tab's two columns. It mirrors
 * `DetailShell` closely enough that nothing jumps when the data lands — the
 * old skeleton drew a 448px stack of cards and then snapped to a tabbed
 * two-column page, which read as the screen loading twice.
 */
export function DetailSkeleton({ rail = false }: { rail?: boolean }) {
  return (
    <div>
      <Skeleton className="h-4 w-20" />
      <div className="mt-2 flex items-center justify-between gap-3">
        <div>
          <Skeleton className="h-3 w-12" />
          <Skeleton className="mt-1.5 h-6 w-44" />
        </div>
        <Skeleton className="h-5 w-28" />
      </div>
      {rail ? <Skeleton className="mt-3 h-[72px] w-full rounded-lg" /> : null}
      <div className="mt-3 flex gap-4 border-b border-rule pb-2 pt-1.5">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="mt-4 flex flex-col gap-3 md:grid md:grid-cols-3 md:items-start md:gap-5">
        <div className="flex flex-col gap-3 md:col-span-2">
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-28 w-full rounded-lg" />
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-control w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { TabStrip, type TabItem } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

/**
 * The shell every record screen wears — a track, a customer, a batch
 * (SPEC 5.0, D-012).
 *
 * It exists because those three screens had grown into the same thing by
 * accident and diverged in every detail: a stack of eight cards in a 448px
 * column, identical on a phone and on a 27" monitor, where reaching "change
 * status" meant scrolling past the photo gallery and the whole event history.
 *
 * The fix is one head and a tab strip. The head carries what identifies the
 * record and never scrolls out of reach on a phone; the first tab carries
 * everything needed to ACT on it, so the primary controls are never behind a
 * tab; the rest — photos, history, delivery log — are one tap away instead of
 * one long scroll away.
 */
export function DetailShell({
  backHref,
  backLabel,
  eyebrow,
  title,
  status,
  rail,
  tabs,
  activeTab,
  buildTabHref,
  children,
}: {
  backHref: string;
  backLabel: string;
  /** The record's kind — `TREK`, `MIJOZ`, `REYS`. */
  eyebrow: ReactNode;
  title: ReactNode;
  /** Right of the title: a status chip, a debt figure, whatever states it. */
  status?: ReactNode;
  /** Optional progress rail under the title (the track's China → Tashkent). */
  rail?: ReactNode;
  tabs: readonly TabItem[];
  activeTab: string;
  buildTabHref: (key: string) => string;
  children: ReactNode;
}) {
  return (
    <div>
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 rounded-sm text-small text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {backLabel}
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <div className="min-w-0">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="truncate text-title font-semibold text-ink">{title}</h1>
        </div>
        {status ? <div className="flex-none">{status}</div> : null}
      </div>

      {rail ? <div className="mt-3">{rail}</div> : null}

      {/* Sticky under the app header (52px) so the tabs stay reachable while
          reading a long history — the one part of the record that can run to
          several screens even after the split.
          The bleed to the screen edge lives HERE rather than on the strip: the
          sticky element has to paint its own background all the way across, or
          the content scrolling underneath shows through beside the tabs. */}
      <div className="sticky top-[52px] z-10 -mx-4 mt-3 bg-surface px-4 md:mx-0 md:bg-background md:px-0">
        <TabStrip items={tabs} active={activeTab} buildHref={buildTabHref} />
      </div>

      <div className="mt-4">{children}</div>
    </div>
  );
}

/**
 * The first tab's two columns: the record on the left, who it belongs to and
 * what can be done to it on the right. One column on a phone, where the side
 * panel simply follows the record.
 */
export function DetailColumns({
  main,
  side,
  className,
}: {
  main: ReactNode;
  side: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 md:grid md:grid-cols-3 md:items-start md:gap-5',
        className,
      )}
    >
      <div className="flex flex-col gap-3 md:col-span-2">{main}</div>
      {/* Sticky on desktop: the actions stay in view while the left column
          scrolls, which is the whole reason the counter staff open this page.
          96px = the 52px top bar plus the sticky tab strip that sits under it. */}
      <div className="flex flex-col gap-3 md:sticky md:top-[96px]">{side}</div>
    </div>
  );
}

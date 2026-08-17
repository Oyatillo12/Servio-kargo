import Link from 'next/link';

import { cn } from '@/lib/utils';

/**
 * The tab strip every detail screen wears (SPEC 5.0, D-012).
 *
 * These are LINKS, not a client-side tab widget, and the active tab lives in
 * the URL (`?tab=…`). That is the whole point: the page stays a Server
 * Component, a reload keeps the tab, the browser's back button walks tabs the
 * way a user expects, and a colleague can be sent straight to the photos of a
 * parcel rather than to the parcel and a sentence about where to click.
 *
 * An unknown value falls back to the first tab instead of 404-ing — the same
 * way `?status=` degrades on /tracks, so a stale bookmark still opens.
 */
export interface TabItem {
  /** URL value. The first item's key is the default and is omitted from links. */
  key: string;
  label: string;
  /** Shown beside the label when the number is the reason to open the tab. */
  count?: number;
}

/** The active tab for a raw `?tab=` value — unknown or absent → the first. */
export function resolveTab(items: readonly TabItem[], raw?: string): string {
  const first = items[0]?.key ?? '';
  if (!raw) return first;
  return items.some((t) => t.key === raw) ? raw : first;
}

export interface TabStripProps {
  items: readonly TabItem[];
  active: string;
  /** Href for a tab. The default tab should produce a link without `?tab=`. */
  buildHref: (key: string) => string;
  className?: string;
}

export function TabStrip({
  items,
  active,
  buildHref,
  className,
}: TabStripProps) {
  return (
    <nav
      className={cn(
        // Scrolls itself on a phone rather than wrapping to a second row: two
        // rows of tabs push the content down by a whole thumb-width, and the
        // strip is sticky under the head, where every pixel is the record's.
        // Bleeding to the screen edge is the caller's job (see `DetailShell`),
        // so a sticky wrapper can paint the background under the bleed.
        'flex gap-1 overflow-x-auto border-b border-rule',
        '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {items.map((item) => {
        const isActive = item.key === active;
        return (
          <Link
            key={item.key}
            href={buildHref(item.key)}
            aria-current={isActive ? 'page' : undefined}
            scroll={false}
            className={cn(
              'flex flex-none items-center gap-1.5 whitespace-nowrap border-b-2 px-3 pb-2 pt-1.5 font-display text-small font-medium uppercase tracking-[0.06em] transition-colors',
              isActive
                ? 'border-signal text-ink'
                : 'border-transparent text-faint hover:text-ink-2',
            )}
          >
            {item.label}
            {item.count != null && item.count > 0 ? (
              <span
                className={cn(
                  'rounded-sm px-1 font-mono text-micro font-semibold tabular-nums',
                  isActive ? 'bg-signal-soft text-signal-strong' : 'bg-surface-alt text-faint',
                )}
              >
                {item.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

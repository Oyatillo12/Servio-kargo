import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * A block of the dashboard / settings screens, which the design renders two
 * different ways (screens 1a vs 1b, 2a vs 2b).
 *
 * On a phone there are no cards: sections run edge to edge on white and are
 * separated by an 8px band of `n-band`. Card margins would cost ~32px of the
 * 380px a warehouse phone has, and rounded corners on a full-width block read
 * as decoration rather than structure. The band is the page background showing
 * through the gap — see `SectionStack` — so a section only has to draw its own
 * hairline top/bottom rule.
 *
 * From `md` up the same block becomes a normal bordered card on the canvas.
 *
 * `flush` drops the horizontal padding for edge-to-edge row lists (the work
 * queue, the tariff list); rows then carry their own `px-4`.
 */
export interface PanelSectionProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  title?: React.ReactNode;
  /** Muted text on the right of the title row. */
  meta?: React.ReactNode;
  /** Control on the right of the title row; wins over `meta` when both given. */
  action?: React.ReactNode;
  flush?: boolean;
  /** Renders the block as a plain `<div>` — use inside an existing `<section>`. */
  as?: 'section' | 'div';
}

export function PanelSection({
  title,
  meta,
  action,
  flush,
  as: Tag = 'section',
  className,
  children,
  ...props
}: PanelSectionProps) {
  return (
    <Tag
      className={cn(
        'border-y border-n-200 bg-white md:rounded-lg md:border',
        className,
      )}
      {...props}
    >
      {title || meta || action ? (
        <div
          className={cn(
            'flex items-center justify-between gap-3 px-4 pt-3.5',
            flush ? 'pb-2.5' : 'pb-0',
          )}
        >
          {/* The title wraps rather than truncates: next to a switch
              ("Weekly auto-reminder") it is the label for what that switch
              does, and half of it is worse than two lines of it. */}
          {title ? (
            <h2 className="min-w-0 font-display text-body font-semibold uppercase tracking-[0.06em] text-ink">
              {title}
            </h2>
          ) : (
            <span />
          )}
          {action ?? (
            meta ? (
              <span className="flex-none text-small text-faint">{meta}</span>
            ) : null
          )}
        </div>
      ) : null}
      <div className={cn(!flush && 'px-4 pb-4', !flush && !title && 'pt-4', !flush && title && 'pt-3')}>
        {children}
      </div>
    </Tag>
  );
}

/**
 * Vertical stack of `PanelSection`s. The 8px gap on phones is what produces
 * the grey bands between full-bleed sections — the stack paints `n-band` and
 * the white sections sit on top of it — and it opens up to the 16px card
 * gutter on desktop. `-mx-4` cancels the shell's mobile page padding so the
 * sections really do reach the screen edge.
 */
export function SectionStack({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        '-mx-4 flex flex-col gap-2 bg-n-band',
        'md:mx-0 md:gap-4 md:bg-transparent',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

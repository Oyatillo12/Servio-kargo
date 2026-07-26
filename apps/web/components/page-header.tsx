import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Page title row shared by the list pages — replaces the repeated
 * `mb-3 flex items-baseline justify-between` + `text-xl font-bold` + "jami N"
 * counter. Provide `count` for the muted "jami N" chip, or a `right` slot for a
 * custom control (e.g. the dashboard period toggle).
 */
export interface PageHeaderProps {
  title: React.ReactNode;
  /** Muted "jami {count}" indicator on the right. */
  count?: React.ReactNode;
  /** Custom right-side content; takes precedence over `count`. */
  right?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, count, right, className }: PageHeaderProps) {
  return (
    <div
      // Wrapping matters on phones: a right slot with two or three controls
      // (count + Excel + "Yangi …") is wider than a 360px viewport next to the
      // title, and without `flex-wrap` it pushed straight off the screen.
      className={cn(
        'mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2',
        className,
      )}
    >
      <h1 className="min-w-0 truncate text-xl font-bold text-foreground">
        {title}
      </h1>
      {right ? (
        <div className="ml-auto flex-none">{right}</div>
      ) : count != null ? (
        <span className="ml-auto flex-none text-xs text-muted-foreground">
          jami <span className="font-mono font-semibold">{count}</span>
        </span>
      ) : null}
    </div>
  );
}

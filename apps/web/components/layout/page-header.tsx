import * as React from 'react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

/**
 * Page title row shared by the list pages — replaces the repeated
 * `mb-3 flex items-baseline justify-between` + `text-xl font-bold` + "total N"
 * counter. Provide `count` for the muted "total N" chip, or a `right` slot for
 * a custom control (e.g. the dashboard period toggle).
 */
export interface PageHeaderProps {
  title: React.ReactNode;
  /** Muted "total {count}" indicator on the right. */
  count?: number;
  /** Custom right-side content; rendered after the count when both are given. */
  right?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, count, right, className }: PageHeaderProps) {
  const t = useTranslations('common');

  return (
    <div
      // Wrapping matters on phones: a right slot with two or three controls
      // (count + Excel + "New …") is wider than a 360px viewport next to the
      // title, and without `flex-wrap` it pushed straight off the screen.
      className={cn(
        'mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2',
        className,
      )}
    >
      {/* The screen's name in the system's display voice — the one place a
          page shouts, and it does it condensed so a long Russian title
          ("Уведомления") still fits beside two controls on a 360px phone. */}
      <h1 className="min-w-0 truncate font-display text-title font-semibold uppercase tracking-[0.04em] text-ink">
        {title}
      </h1>
      {count != null || right ? (
        <div className="ml-auto flex flex-none items-center gap-2">
          {count != null ? (
            <span className="text-small text-muted-foreground">
              {t('total')}{' '}
              <span className="font-mono font-semibold tabular-nums">{count}</span>
            </span>
          ) : null}
          {right}
        </div>
      ) : null}
    </div>
  );
}

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * The row of named values that describes a record — weight, price, batch, debt
 * (SPEC 5.0). It is the panel's most repeated shape, and it was hand-built at
 * every call site before, which is why the same four figures had three
 * different label sizes across three screens.
 *
 * Cells are separated by the grid's own 1px gap showing the ground through
 * (`gap-px` over `bg-rule-soft`) rather than by borders on each cell: one rule
 * between two cells, never two hairlines stacked.
 */
export function DataList({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <dl
      className={cn(
        'grid grid-cols-2 gap-px bg-rule-soft sm:grid-cols-4',
        className,
      )}
    >
      {children}
    </dl>
  );
}

export function DataItem({
  label,
  value,
  unit,
  /** `debt` prints the figure in red — the one value that is never neutral. */
  tone,
  /** Figures compared down a column are mono; prose (a name, a batch) is not. */
  mono = true,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  tone?: 'debt' | 'muted';
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('bg-surface px-4 py-3', className)}>
      <dt className="eyebrow">{label}</dt>
      <dd
        className={cn(
          'mt-0.5 text-lead font-semibold',
          mono && 'font-mono tabular-nums',
          tone === 'debt'
            ? 'text-destructive'
            : tone === 'muted'
              ? 'text-faint'
              : 'text-ink',
        )}
      >
        {value}
        {unit ? (
          <span className="ms-1 font-sans text-micro font-normal text-ink-3">
            {unit}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

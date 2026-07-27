import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * The centered "topilmadi" block used on the list pages — replaces the
 * duplicated dotted-circle empty state. Defaults to the dotted-circle mark;
 * pass `icon` to override it (e.g. a green check for "no debtors").
 */
export interface EmptyStateProps {
  title: React.ReactNode;
  hint?: React.ReactNode;
  /** Overrides the default dotted-circle mark. */
  icon?: React.ReactNode;
  /** Optional call-to-action rendered below the hint. */
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  hint,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-white p-10 text-center',
        className,
      )}
    >
      {icon ?? (
        <div className="mx-auto mb-2 h-11 w-11 rounded-full border-2 border-dotted border-[#c3c9d6]" />
      )}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {hint ? (
        <p className="mt-1 text-[13px] text-muted-foreground">{hint}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

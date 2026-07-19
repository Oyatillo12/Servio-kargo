import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * The white bordered card block used across the panel — replaces the repeated
 * `rounded-xl border border-border bg-white p-3.5` + `text-[13.5px] font-semibold`
 * heading pattern. Pass `title` (optional) for a heading row with an optional
 * `action` on the right and a `description` under it.
 */
export interface SectionCardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** Removes the default inner padding (for edge-to-edge lists inside a card). */
  flush?: boolean;
}

const SectionCard = React.forwardRef<HTMLDivElement, SectionCardProps>(
  ({ title, description, action, flush, className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-xl border border-border bg-white',
        !flush && 'p-3.5',
        className,
      )}
      {...props}
    >
      {title || action ? (
        <div
          className={cn(
            'flex items-start justify-between gap-3',
            flush && 'p-3.5 pb-0',
            children && !flush && 'mb-3',
          )}
        >
          <div className="min-w-0">
            {title ? (
              <h2 className="text-[13.5px] font-semibold text-foreground">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          {action ? <div className="flex-none">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  ),
);
SectionCard.displayName = 'SectionCard';

export { SectionCard };

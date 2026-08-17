import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * One number and what it counts — the dashboard's unit of measure (SPEC 5.10).
 *
 * `alert` marks a figure that wants a human: it is drawn with amber ink, a
 * hatched ground and a warning icon TOGETHER, never by colour alone (SPEC 5.0).
 * A zero is never an alert — "nobody blocked us" is the normal state, and it
 * prints quiet grey so a screen of zeros reads as calm rather than as a wall.
 */
export function StatTile({
  label,
  sublabel,
  value,
  alert,
  className,
}: {
  label: ReactNode;
  sublabel?: ReactNode;
  value: number | string;
  alert?: boolean;
  className?: string;
}) {
  const isZero = value === 0 || value === '0';
  const flagged = Boolean(alert) && !isZero;

  return (
    <div
      className={cn(
        'relative flex h-full items-center gap-3 overflow-hidden border-y border-rule bg-surface px-4 py-3 md:rounded-lg md:border',
        flagged && 'border-warning/40 ps-5',
        className,
      )}
    >
      {/* Hazard tape down the edge rather than behind the words: the second
          channel has to be unmistakable without making the number harder to
          read, which a full hatched ground does. */}
      {flagged ? (
        <span aria-hidden className="hatch absolute inset-y-0 start-0 w-2" />
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="eyebrow block truncate">{label}</span>
        <span className="mt-0.5 flex items-center gap-1.5">
          {flagged ? (
            <AlertTriangle
              className="h-3.5 w-3.5 flex-none text-warning"
              strokeWidth={2}
              aria-hidden
            />
          ) : null}
          {sublabel ? (
            <span className="block truncate text-small text-ink-2">
              {sublabel}
            </span>
          ) : null}
        </span>
      </span>
      <span
        className={cn(
          'flex-none font-mono text-title font-semibold tabular-nums md:text-display',
          isZero ? 'text-faint' : flagged ? 'text-warning' : 'text-ink',
        )}
      >
        {value}
      </span>
    </div>
  );
}

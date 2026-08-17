import Link from 'next/link';

import { cn } from '@/lib/utils';

export interface FilterChip {
  /** Stable key; also the value the chip filters by (`undefined` = "all"). */
  value: string | undefined;
  label: string;
  /** Optional leading emoji — used by the status chips. */
  emoji?: string;
  count?: number;
}

/**
 * Horizontally scrollable filter row (status chips on /tracks).
 *
 * The scrollbar is hidden but the row stays scrollable and keyboard-reachable:
 * on a 360px phone the eight status chips are about twice the viewport wide, and
 * a visible scrollbar there eats a third of the row's height.
 */
export function FilterChips({
  chips,
  active,
  buildHref,
  label,
  className,
}: {
  chips: FilterChip[];
  active: string | undefined;
  buildHref: (value: string | undefined) => string;
  /** Accessible name for the chip group. */
  label: string;
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      className={cn(
        'flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {chips.map((chip) => {
        const isActive = chip.value === active;
        return (
          <Link
            key={chip.value ?? '__all__'}
            href={buildHref(chip.value)}
            aria-current={isActive ? 'true' : undefined}
            className={cn(
              'flex flex-none items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-small font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              isActive
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-surface text-ink-2 hover:bg-surface-alt',
            )}
          >
            {chip.emoji ? <span aria-hidden>{chip.emoji}</span> : null}
            {chip.label}
            {chip.count != null ? (
              <span
                className={cn(
                  'font-mono tabular-nums',
                  isActive ? 'text-primary-foreground/70' : 'text-faint',
                )}
              >
                {chip.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

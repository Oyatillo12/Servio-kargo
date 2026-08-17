import Link from 'next/link';

import { cn } from '@/lib/utils';

/**
 * Segmented control — one bordered box, no gaps between the options, the
 * chosen one filled with signal (SPEC 5.10's period toggle, and any other
 * "pick exactly one of two or three" that belongs in a title row).
 *
 * Link-based like `TabStrip`, for the same reason: the choice is a URL, so it
 * survives a reload and can be sent to a colleague. Where the choice is NOT a
 * URL, pass `onSelect`-style buttons instead — this component deliberately
 * does not grow a client mode.
 */
export interface SegmentedOption {
  value: string;
  label: string;
  href: string;
}

export function Segmented({
  options,
  active,
  label,
  className,
}: {
  options: readonly SegmentedOption[];
  active: string;
  /** Accessible name for the group — what is being chosen. */
  label: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        // `inline-flex`, so the box hugs its options wherever it is dropped —
        // as a block it stretched to the width of whatever contained it.
        'inline-flex flex-none overflow-hidden rounded-md border border-input bg-surface',
        className,
      )}
    >
      {options.map((opt, i) => {
        const isActive = opt.value === active;
        return (
          <Link
            key={opt.value}
            href={opt.href}
            aria-current={isActive ? 'true' : undefined}
            className={cn(
              'px-2.5 py-1.5 text-small transition-colors md:px-3',
              i > 0 && 'border-s border-input',
              isActive
                ? 'bg-primary font-semibold text-primary-foreground'
                : 'text-muted-foreground hover:bg-surface-alt hover:text-foreground',
            )}
          >
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}

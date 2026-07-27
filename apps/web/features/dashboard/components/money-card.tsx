import Link from 'next/link';

import { cn } from '@/lib/utils';

/**
 * One of the two money figures at the top of the dashboard (SPEC §5.10).
 *
 * Label left / figure right on phones, stacked once the grid splits into two
 * columns — the row layout is what buys the figure enough width to stay at full
 * size and on one line. A 9-digit som total in a 130px column either wrapped
 * mid-number or shrank out of legibility.
 */
export function MoneyCard({
  icon,
  label,
  value,
  unit,
  sub,
  negative,
  href,
  index = 0,
}: {
  icon: string;
  label: string;
  /** Already formatted with thousands separators. */
  value: string;
  /** Currency suffix, rendered smaller after the figure. */
  unit: string;
  sub?: string;
  negative?: boolean;
  href?: string;
  index?: number;
}) {
  const body = (
    <div
      className={cn(
        'animate-fade-in-up flex min-w-0 items-center justify-between gap-3 rounded-xl border bg-white p-3.5 transition-colors sm:block',
        negative ? 'border-[#f3d6d4] hover:bg-[#fdf6f6]' : 'border-border',
      )}
      style={{ animationDelay: `${index * 45}ms` }}
    >
      <div className="flex min-w-0 items-center gap-1.5 text-[12px] text-muted-foreground">
        <span className="text-sm leading-none" aria-hidden>
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </div>
      <div className="flex-none text-right sm:text-left">
        <p
          className={cn(
            'whitespace-nowrap font-mono text-[21px] font-bold leading-tight tabular-nums sm:mt-1.5',
            negative ? 'text-[#b3261e]' : 'text-foreground',
          )}
        >
          {value}
          <span className="ml-1 text-[11px] font-medium text-muted-foreground">
            {unit}
          </span>
        </p>
        {sub ? (
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {sub}
          </p>
        ) : null}
      </div>
    </div>
  );

  return href ? (
    <Link
      href={href}
      className="min-w-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {body}
    </Link>
  ) : (
    body
  );
}

import { cn } from '@/lib/utils';

/**
 * Manifest-style section heading: a numbered monospace kicker over the title,
 * like a field label on a waybill.
 */
export function SectionHeading({
  index,
  kicker,
  title,
  dark = false,
  className,
}: {
  index: string;
  kicker: string;
  title: string;
  dark?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('max-w-2xl', className)}>
      <p
        className={cn(
          'font-mono text-[11px] font-semibold uppercase tracking-[0.22em]',
          dark ? 'text-[#E0873A]' : 'text-[#C2691E]',
        )}
      >
        {index} — {kicker}
      </p>
      <h2
        className={cn(
          'mt-2.5 text-[26px] font-extrabold leading-tight tracking-tight sm:text-[32px]',
          dark ? 'text-white' : 'text-[#16143B]',
        )}
      >
        {title}
      </h2>
    </div>
  );
}

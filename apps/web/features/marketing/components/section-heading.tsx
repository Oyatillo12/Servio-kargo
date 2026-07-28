import { cn } from '@/lib/utils';

/**
 * A section title, and nothing else.
 *
 * The previous version stacked a mono index ("01 —") over an uppercase kicker
 * over the title, on every one of eight sections. Repeated that many times the
 * device stops labelling anything and just reads as decoration, so it's gone:
 * a heading and an optional line of lead copy carry the section on their own.
 */
export function SectionHeading({
  title,
  lead,
  dark = false,
  className,
}: {
  title: string;
  lead?: string;
  dark?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('max-w-2xl', className)}>
      <h2
        className={cn(
          'text-[26px] font-extrabold leading-[1.15] tracking-[-0.02em] sm:text-[34px]',
          dark ? 'text-white' : 'text-[#1A1D21]',
        )}
      >
        {title}
      </h2>
      {lead ? (
        <p
          className={cn(
            'mt-3 text-[15px] leading-relaxed',
            dark ? 'text-[#9CA3AF]' : 'text-[#5C6270]',
          )}
        >
          {lead}
        </p>
      ) : null}
    </div>
  );
}

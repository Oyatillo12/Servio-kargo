import { cn } from '@/lib/utils';

/**
 * A section opener in the TERMINAL voice: a mono waybill index
 * (`01 / IMPORT`), a condensed uppercase title, an optional lead.
 *
 * The index earns its place here (it was cut from the previous design as
 * decoration): the page now reads as one document — a waybill with numbered
 * fields — and the running index is what carries that reading.
 */
export function SectionHeading({
  index,
  kicker,
  title,
  lead,
  dark = false,
  className,
}: {
  /** Two-digit position in the page's running order, e.g. "02". */
  index?: string;
  /** Uppercase micro-label after the index, e.g. "IMPORT". */
  kicker?: string;
  title: string;
  lead?: string;
  dark?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('max-w-2xl', className)}>
      {index || kicker ? (
        <p
          className={cn(
            'mb-3 flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.14em]',
            dark ? 'text-white/50' : 'text-ink-3',
          )}
        >
          {index ? <span className="text-signal">{index}</span> : null}
          {index && kicker ? <span aria-hidden>/</span> : null}
          {kicker ? <span>{kicker}</span> : null}
        </p>
      ) : null}
      <h2
        className={cn(
          'font-display text-[30px] font-semibold uppercase leading-[1.06] tracking-[0.01em] sm:text-[40px]',
          dark ? 'text-white' : 'text-ink',
        )}
      >
        {title}
      </h2>
      {lead ? (
        <p
          className={cn(
            'mt-4 text-[16px] leading-relaxed',
            dark ? 'text-white/65' : 'text-ink-2',
          )}
        >
          {lead}
        </p>
      ) : null}
    </div>
  );
}

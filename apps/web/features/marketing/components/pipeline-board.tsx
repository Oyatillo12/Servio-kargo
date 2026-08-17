import { PIPELINE_ORDER, STATUS_META, type Lang } from '@kargotrack/shared';

/**
 * The product's six-stage pipeline as a departure board — an ink band with
 * the stages in Oswald caps, read from `STATUS_META` (domain vocabulary lives
 * in `packages/shared`, CLAUDE.md rule 5 — never copied into messages).
 *
 * This is the one strip of pure atmosphere on the page, but it is not
 * invented atmosphere: these are the exact statuses the visitor's customers
 * will read in the bot, in order, with the same "now" dot the panel's route
 * rail uses. IN_TRANSIT carries the pulse — the stage a cargo owner stares
 * at.
 */
export function PipelineBoard({ locale }: { locale: Lang }) {
  return (
    <div className="border-y border-foreground/80 bg-ink">
      <div className="mx-auto w-full max-w-6xl overflow-x-auto px-5 sm:px-6">
        <ol className="flex w-max min-w-full items-center gap-4 py-3.5 sm:justify-between sm:gap-6">
          {PIPELINE_ORDER.map((status, i) => {
            const now = status === 'IN_TRANSIT';
            return (
              <li
                key={status}
                className="flex shrink-0 items-center gap-4 sm:gap-6"
              >
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={
                      now
                        ? 'board-now h-1.5 w-1.5 rounded-full bg-signal'
                        : 'h-1.5 w-1.5 rounded-full bg-white/25'
                    }
                  />
                  <span
                    className={`font-display text-[13px] font-medium uppercase tracking-[0.13em] ${
                      now ? 'text-white' : 'text-white/55'
                    }`}
                  >
                    {STATUS_META[status][locale]}
                  </span>
                </span>
                {i < PIPELINE_ORDER.length - 1 ? (
                  <span aria-hidden className="font-mono text-[11px] text-white/25">
                    →
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

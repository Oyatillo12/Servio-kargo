import { formatSom } from '@kargotrack/shared';
import type { TushumPoint } from '@kargotrack/shared';

/** `YYYY-MM-DD` → `DD.MM` (the key is already a Tashkent calendar day). */
function shortDate(dateKey: string): string {
  const [, m, d] = dateKey.split('-');
  return `${d}.${m}`;
}

/**
 * Daily-tushum bar chart for the last 14 days (SPEC §5.10). Pure CSS bars, no
 * charting dependency: each bar is heighted relative to the busiest day; hover
 * (or long-press) shows the day + som via the native `title` tooltip. Points
 * arrive oldest-first, zero-filled.
 */
export function TushumChart({ points }: { points: TushumPoint[] }) {
  const max = Math.max(1, ...points.map((p) => p.totalTiyin));
  const hasData = points.some((p) => p.totalTiyin > 0);

  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-foreground">
          Kunlik tushum · 14 kun
        </h2>
        <span className="text-[11px] text-muted-foreground">so&apos;m</span>
      </div>

      {hasData ? (
        <div className="flex h-40 items-end gap-1.5">
          {points.map((p) => {
            // Give non-zero days a visible minimum so tiny values still read.
            const pct = p.totalTiyin > 0 ? Math.max(4, (p.totalTiyin / max) * 100) : 0;
            return (
              <div
                key={p.dateKey}
                className="flex flex-1 flex-col items-center justify-end gap-1"
                title={`${shortDate(p.dateKey)} — ${formatSom(p.totalTiyin)} so'm`}
              >
                <div
                  className="w-full rounded-t bg-primary/80"
                  style={{ height: `${pct}%` }}
                />
                <span className="text-[9px] leading-none text-muted-foreground">
                  {shortDate(p.dateKey)}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex h-40 items-center justify-center text-[13px] text-muted-foreground">
          Bu davrda tushum bo&apos;lmagan.
        </div>
      )}
    </div>
  );
}

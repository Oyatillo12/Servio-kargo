import { formatSom } from '@kargotrack/shared';

/**
 * Debt display (SPEC §7.5): positive = red `{n} so'm`, negative = green
 * `Avans: {n} so'm`, zero = muted dash. Never shows a leading minus sign.
 *
 * `formatSom` groups thousands with plain spaces, which a narrow phone column
 * will happily break mid-number ("45 000" / "000") — hence `whitespace-nowrap`.
 */
export function DebtCell({ tiyin }: { tiyin: number }) {
  if (tiyin > 0) {
    return (
      <span className="whitespace-nowrap font-mono font-semibold tabular-nums text-[#b3261e]">
        {formatSom(tiyin)} so&apos;m
      </span>
    );
  }
  if (tiyin < 0) {
    return (
      <span className="whitespace-nowrap font-mono font-medium tabular-nums text-[#177338]">
        Avans: {formatSom(Math.abs(tiyin))} so&apos;m
      </span>
    );
  }
  return <span className="text-muted-foreground">qarz yo&apos;q</span>;
}

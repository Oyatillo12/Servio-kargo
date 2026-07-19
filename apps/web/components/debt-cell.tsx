import { formatSom } from '@kargotrack/shared';

/**
 * Debt display (SPEC §7.5): positive = red `{n} so'm`, negative = green
 * `Avans: {n} so'm`, zero = muted dash. Never shows a leading minus sign.
 */
export function DebtCell({ tiyin }: { tiyin: number }) {
  if (tiyin > 0) {
    return (
      <span className="font-mono font-semibold text-[#b3261e]">
        {formatSom(tiyin)} so&apos;m
      </span>
    );
  }
  if (tiyin < 0) {
    return (
      <span className="font-mono font-medium text-[#177338]">
        Avans: {formatSom(Math.abs(tiyin))} so&apos;m
      </span>
    );
  }
  return <span className="text-muted-foreground">qarz yo&apos;q</span>;
}

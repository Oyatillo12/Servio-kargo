import { formatSom } from '@kargotrack/shared';

/**
 * Debt display (SPEC §7.5): positive = red `{n} so'm`, negative = green
 * `Avans: {n} so'm`, zero = muted dash. Never shows a leading minus sign.
 */
export function DebtCell({ tiyin }: { tiyin: number }) {
  if (tiyin > 0) {
    return (
      <span className="font-semibold text-red-600">{formatSom(tiyin)} so'm</span>
    );
  }
  if (tiyin < 0) {
    return (
      <span className="font-medium text-green-600">
        Avans: {formatSom(Math.abs(tiyin))} so'm
      </span>
    );
  }
  return <span className="text-slate-400">—</span>;
}

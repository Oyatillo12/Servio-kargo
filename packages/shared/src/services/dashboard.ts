/**
 * Owner-dashboard period math (SPEC §5.10, §7.9).
 *
 * The dashboard periods (`Bugun` / `7 kun` / `30 kun`) and the 14-day tushum
 * chart all reason about *Asia/Tashkent calendar days*, but timestamps are
 * stored in UTC (§7.9). These pure, framework-free helpers convert a "now"
 * instant into the half-open UTC ranges the tenant-scoped aggregate queries
 * filter on, and bucket an instant into its Tashkent calendar day for the
 * chart. Mirrors the Tashkent-projection approach in `services/reminder.ts`
 * (`en-CA` renders ISO `YYYY-MM-DD`; the offset is derived from `Intl`, never
 * hardcoded, so the math survives any zone/DST). Unit-tested, including the
 * UTC↔Tashkent midnight edge where the Tashkent day flips at 19:00 UTC.
 */

/** Display/scheduling timezone for all dashboard logic (§7.9). */
export const DASHBOARD_TZ = 'Asia/Tashkent';

export type DashboardPeriod = 'today' | '7d' | '30d';

/** Selectable periods, in toggle order (`Bugun / 7 kun / 30 kun`). */
export const DASHBOARD_PERIODS: readonly DashboardPeriod[] = ['today', '7d', '30d'];

/** How many Tashkent calendar days each period spans, ending with today. */
const PERIOD_DAYS: Record<DashboardPeriod, number> = { today: 1, '7d': 7, '30d': 30 };

/** Days shown in the tushum bar chart (§5.10). */
export const TUSHUM_CHART_DAYS = 14;

const DAY_MS = 86_400_000;

/** A half-open UTC instant range `[startUtc, endUtc)`. */
export interface PeriodRange {
  startUtc: Date;
  endUtc: Date;
}

export interface DayBucket {
  /** Tashkent calendar day, ISO `YYYY-MM-DD`. */
  dateKey: string;
  startUtc: Date;
  endUtc: Date;
}

export interface TushumPoint {
  dateKey: string;
  totalTiyin: number;
}

/**
 * Offset of `timeZone` from UTC at `date`, in milliseconds (tz − UTC). For
 * Asia/Tashkent this is a constant +5h, but we derive it from `Intl` so the
 * math stays correct for any zone/DST.
 */
function tzOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (t: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return asUtc - date.getTime();
}

/**
 * The Tashkent calendar day of an instant as an ISO `YYYY-MM-DD` string. Used to
 * bucket payments into the chart's daily columns. (en-CA renders ISO order.)
 */
export function tashkentDateKey(date: Date, timeZone = DASHBOARD_TZ): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** The UTC instant at which the given Tashkent calendar day begins (00:00). */
function startOfDayUtc(dateKey: string, timeZone: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number) as [number, number, number];
  const midnightAsUtc = Date.UTC(y, m - 1, d, 0, 0, 0);
  // The offset can only be sampled from a real instant; noon of the day is
  // safely clear of any DST transition, so use it to size the shift.
  const offset = tzOffsetMs(new Date(midnightAsUtc + 12 * 3_600_000), timeZone);
  return new Date(midnightAsUtc - offset);
}

/**
 * The half-open UTC range for a dashboard period: ending at the end of *today*
 * (start of tomorrow) in Tashkent and reaching back `PERIOD_DAYS[period]` days.
 * `today` → just today; `7d`/`30d` → today plus the preceding 6 / 29 days.
 */
export function periodRange(
  now: Date,
  period: DashboardPeriod,
  timeZone = DASHBOARD_TZ,
): PeriodRange {
  const days = PERIOD_DAYS[period];
  const startOfToday = startOfDayUtc(tashkentDateKey(now, timeZone), timeZone);
  return {
    startUtc: new Date(startOfToday.getTime() - (days - 1) * DAY_MS),
    endUtc: new Date(startOfToday.getTime() + DAY_MS),
  };
}

/**
 * The last `n` Tashkent calendar days ending today, oldest first — the columns
 * of the tushum chart. `[first.startUtc, last.endUtc)` is the single window the
 * payments query fetches; callers bucket rows via `bucketDailyTushum`.
 */
export function lastNDays(
  now: Date,
  n: number,
  timeZone = DASHBOARD_TZ,
): DayBucket[] {
  const startOfToday = startOfDayUtc(tashkentDateKey(now, timeZone), timeZone);
  const buckets: DayBucket[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const startUtc = new Date(startOfToday.getTime() - i * DAY_MS);
    const endUtc = new Date(startUtc.getTime() + DAY_MS);
    buckets.push({
      dateKey: tashkentDateKey(startUtc, timeZone),
      startUtc,
      endUtc,
    });
  }
  return buckets;
}

/**
 * Sum payment amounts into their Tashkent-day buckets (chart columns). Rows
 * outside the buckets' span are ignored; empty days come back as `0`.
 */
export function bucketDailyTushum(
  buckets: DayBucket[],
  payments: { amountTiyin: number; createdAt: Date }[],
  timeZone = DASHBOARD_TZ,
): TushumPoint[] {
  const totals = new Map<string, number>();
  for (const b of buckets) totals.set(b.dateKey, 0);
  for (const p of payments) {
    const key = tashkentDateKey(p.createdAt, timeZone);
    const current = totals.get(key);
    if (current !== undefined) totals.set(key, current + p.amountTiyin);
  }
  return buckets.map((b) => ({ dateKey: b.dateKey, totalTiyin: totals.get(b.dateKey)! }));
}

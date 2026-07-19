/**
 * Debt-reminder queue contract + scheduling helpers (SPEC §4.4, §7.7, §7.9).
 *
 * Two pg-boss queues:
 *  - `reminder`      — one job per debtor; the bot worker sends the §4.4 message
 *                      (rate-limited, retried). Fired manually (admin button) or
 *                      by the weekly sweep.
 *  - `reminder-sweep`— an hourly scheduled tick; the worker enumerates tenants
 *                      whose configured weekday+hour match "now" (Asia/Tashkent)
 *                      and fans out `reminder` jobs for their debtors.
 *
 * Pure + framework-free (like `notify.ts`): the DB/queue layer owns pg-boss and
 * imports these so producer (web/bot) and consumer (bot) agree on the payload.
 */

/** pg-boss queue for per-customer debt reminders. */
export const REMINDER_QUEUE = 'reminder';

/** pg-boss queue for the hourly debtor-sweep tick (§7.7). */
export const REMINDER_SWEEP_QUEUE = 'reminder-sweep';

/** Cron for the sweep tick: top of every hour. Worker decides who is due. */
export const REMINDER_SWEEP_CRON = '0 * * * *';

/** Display/scheduling timezone for all reminder logic (§7.9). */
export const REMINDER_TZ = 'Asia/Tashkent';

export interface ReminderJob {
  tenantId: string;
  customerId: string;
  /** How the reminder was triggered — for logging/telemetry only. */
  reason: 'manual' | 'weekly';
}

/**
 * Dedupe key for weekly reminders: at most one queued weekly reminder per
 * customer per calendar day (Asia/Tashkent). Used as the pg-boss `singletonKey`
 * so a re-run of the same hourly sweep can't double-message a debtor (§7.7).
 * Manual reminders pass no key (an admin may deliberately re-send).
 */
export function weeklyReminderDedupeKey(
  customerId: string,
  dateKey: string,
): string {
  return `reminder-week:${customerId}:${dateKey}`;
}

/** ISO weekday index 1 = Mon … 7 = Sun, keyed by the en-US short weekday. */
const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

export interface TashkentSchedule {
  /** ISO weekday: 1 = Monday … 7 = Sunday. */
  weekday: number;
  /** Hour of day, 0–23. */
  hour: number;
  /** Calendar day as `YYYY-MM-DD`, for the weekly dedupe key. */
  dateKey: string;
}

/**
 * Project a UTC instant onto the Asia/Tashkent wall clock the sweep reasons
 * about: ISO weekday, hour, and calendar date. Compared against each tenant's
 * `settings.reminders.{weekday,hour}` to decide who is due this hour (§7.7).
 */
export function tashkentSchedule(date: Date): TashkentSchedule {
  const weekdayShort = new Intl.DateTimeFormat('en-US', {
    timeZone: REMINDER_TZ,
    weekday: 'short',
  }).format(date);
  const hourStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: REMINDER_TZ,
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  // en-CA renders ISO `YYYY-MM-DD`.
  const dateKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: REMINDER_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

  return {
    weekday: WEEKDAY_INDEX[weekdayShort] ?? 0,
    hour: Number(hourStr),
    dateKey,
  };
}

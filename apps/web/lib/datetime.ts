/**
 * Admin-panel timestamp formatting. Timestamps are stored in UTC and displayed
 * in Asia/Tashkent (SPEC §7.9). `@kargotrack/shared` already exposes date-only
 * `formatDate`; the audit timeline also needs the time, so it lives here.
 */

const DISPLAY_TZ = 'Asia/Tashkent';

/** `DD.MM.YYYY HH:mm` in Asia/Tashkent. */
export function formatDateTime(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: DISPLAY_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')}.${get('month')}.${get('year')} ${get('hour')}:${get('minute')}`;
}

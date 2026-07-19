import { describe, expect, it } from 'vitest';

import { tashkentSchedule, weeklyReminderDedupeKey } from './reminder';

describe('tashkentSchedule (SPEC §7.7, §7.9)', () => {
  it('projects a UTC instant onto the Asia/Tashkent (UTC+5) wall clock', () => {
    // 2026-07-20 is a Monday. 06:00Z → 11:00 Tashkent.
    expect(tashkentSchedule(new Date('2026-07-20T06:00:00Z'))).toEqual({
      weekday: 1,
      hour: 11,
      dateKey: '2026-07-20',
    });
  });

  it('rolls weekday/date forward across the +5h midnight boundary', () => {
    // Sunday 2026-07-19 20:00Z → Monday 2026-07-20 01:00 Tashkent.
    expect(tashkentSchedule(new Date('2026-07-19T20:00:00Z'))).toEqual({
      weekday: 1,
      hour: 1,
      dateKey: '2026-07-20',
    });
  });
});

describe('weeklyReminderDedupeKey (§7.7)', () => {
  it('is stable per customer + day so a re-run cannot double-message', () => {
    expect(weeklyReminderDedupeKey('cust-1', '2026-07-20')).toBe(
      'reminder-week:cust-1:2026-07-20',
    );
  });
});

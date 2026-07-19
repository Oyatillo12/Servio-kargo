import { describe, expect, it } from 'vitest';

import { formatDate, formatKg, formatSom } from './format';

describe("formatSom (tiyin → grouped so'm)", () => {
  it('groups thousands with spaces', () => {
    expect(formatSom(125_000_000)).toBe('1 250 000');
    expect(formatSom(100_000)).toBe('1 000');
    expect(formatSom(99_900)).toBe('999');
  });

  it("rounds to the nearest whole so'm", () => {
    // 82 550 tiyin = 825.5 so'm → 826
    expect(formatSom(82_550)).toBe('826');
  });

  it('handles zero and negatives (caller usually passes abs)', () => {
    expect(formatSom(0)).toBe('0');
    expect(formatSom(-500_000)).toBe('-5 000');
  });
});

describe('formatKg (grams → kg, ≤2 decimals)', () => {
  it('trims trailing zeros', () => {
    expect(formatKg(1500)).toBe('1.5');
    expect(formatKg(25_000)).toBe('25');
    expect(formatKg(300)).toBe('0.3');
  });

  it('keeps up to two decimals and rounds', () => {
    expect(formatKg(1236)).toBe('1.24');
    expect(formatKg(1234)).toBe('1.23');
  });

  it('formats zero', () => {
    expect(formatKg(0)).toBe('0');
  });
});

describe('formatDate (Asia/Tashkent, DD.MM.YYYY)', () => {
  it('formats a UTC instant in Tashkent local time', () => {
    // 2026-07-19T05:30:00Z → 10:30 in Tashkent (UTC+5), same calendar day
    expect(formatDate(new Date('2026-07-19T05:30:00Z'))).toBe('19.07.2026');
  });

  it('rolls to the next day across the Tashkent midnight boundary', () => {
    // 2026-07-19T20:00:00Z is 01:00 on the 20th in Tashkent (UTC+5)
    expect(formatDate(new Date('2026-07-19T20:00:00Z'))).toBe('20.07.2026');
  });
});

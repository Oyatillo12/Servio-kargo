import { describe, expect, it } from 'vitest';

import { normalizePhone, samePhone, PHONE_KEY_LENGTH } from './phone';

describe('normalizePhone', () => {
  it('reduces every spelling of one UZ number to the same key', () => {
    const key = '901234567';
    expect(normalizePhone('+998901234567')).toBe(key);
    expect(normalizePhone('998901234567')).toBe(key);
    expect(normalizePhone('901234567')).toBe(key);
    expect(normalizePhone('+998 90 123-45-67')).toBe(key);
    expect(normalizePhone(' (90) 123 45 67 ')).toBe(key);
    // Telegram hands the number back without a plus.
    expect(normalizePhone('998 901234567')).toBe(key);
  });

  it('keeps the last 9 digits, so the country prefix never matters', () => {
    expect(normalizePhone('00998901234567')).toBe('901234567');
    expect(normalizePhone('8901234567')).toBe('901234567');
    expect(normalizePhone('901234567')).toHaveLength(PHONE_KEY_LENGTH);
  });

  it('keeps shorter inputs whole rather than padding', () => {
    expect(normalizePhone('12345')).toBe('12345');
  });

  it('returns null when there is nothing comparable', () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('   ')).toBeNull();
    expect(normalizePhone('telefon yo‘q')).toBeNull();
    expect(normalizePhone('+++')).toBeNull();
  });
});

describe('samePhone', () => {
  it('matches across formats', () => {
    expect(samePhone('+998901234567', '901234567')).toBe(true);
    expect(samePhone('998 90 123 45 67', '+998901234567')).toBe(true);
  });

  it('does not match different numbers', () => {
    expect(samePhone('+998901234567', '+998901234568')).toBe(false);
  });

  it('never matches on a missing phone — two unknown numbers are not one person', () => {
    expect(samePhone(null, null)).toBe(false);
    expect(samePhone('', '')).toBe(false);
    expect(samePhone('+998901234567', null)).toBe(false);
  });
});

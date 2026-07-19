import { describe, expect, it } from 'vitest';

import {
  isValidTrackCode,
  normalizeCode,
  TRACK_CODE_MAX_LENGTH,
  TRACK_CODE_MIN_LENGTH,
} from './normalize';

describe('normalizeCode', () => {
  it('uppercases and strips spaces + dashes (SPEC 7.1 example)', () => {
    expect(normalizeCode(' yt-7583 234 uz ')).toBe('YT7583234UZ');
  });

  it('strips CJK characters, keeping ascii-alphanumerics (SPEC 7.1 example)', () => {
    expect(normalizeCode('订单775123456789')).toBe('775123456789');
  });

  it('strips Cyrillic and other non-ascii letters', () => {
    // Cyrillic "АВ" (U+0410 U+0412) should be dropped, not transliterated.
    expect(normalizeCode('АВ123456789')).toBe('123456789');
  });

  it('removes assorted punctuation and separators', () => {
    expect(normalizeCode('sf.123/456#789')).toBe('SF123456789');
    expect(normalizeCode('YT_7583_234')).toBe('YT7583234');
    expect(normalizeCode('a,b,c,d,e,f,g,h')).toBe('ABCDEFGH');
  });

  it('collapses mixed newlines/tabs/commas', () => {
    expect(normalizeCode('AB12\n34\t56,78')).toBe('AB12345678');
  });

  it('handles already-clean codes idempotently', () => {
    const clean = 'YT7583234UZ';
    expect(normalizeCode(clean)).toBe(clean);
    expect(normalizeCode(normalizeCode(clean))).toBe(clean);
  });

  it('returns empty string for input with no alphanumerics', () => {
    expect(normalizeCode('  --- .,! ')).toBe('');
    expect(normalizeCode('')).toBe('');
    expect(normalizeCode('订单')).toBe('');
  });
});

describe('isValidTrackCode', () => {
  it('accepts the normalized SPEC example', () => {
    expect(isValidTrackCode(normalizeCode(' yt-7583 234 uz '))).toBe(true);
  });

  it('rejects too-short codes (SPEC 7.1: SF123)', () => {
    expect(isValidTrackCode(normalizeCode('SF123'))).toBe(false);
  });

  it('accepts CJK-stripped numeric code', () => {
    expect(isValidTrackCode(normalizeCode('订单775123456789'))).toBe(true);
  });

  it('enforces the 8-char lower boundary', () => {
    expect(isValidTrackCode('A'.repeat(TRACK_CODE_MIN_LENGTH - 1))).toBe(false);
    expect(isValidTrackCode('A'.repeat(TRACK_CODE_MIN_LENGTH))).toBe(true);
  });

  it('enforces the 20-char upper boundary', () => {
    expect(isValidTrackCode('A'.repeat(TRACK_CODE_MAX_LENGTH))).toBe(true);
    expect(isValidTrackCode('A'.repeat(TRACK_CODE_MAX_LENGTH + 1))).toBe(false);
  });

  it('rejects the empty string', () => {
    expect(isValidTrackCode('')).toBe(false);
  });
});

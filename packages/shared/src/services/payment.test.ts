import { describe, expect, it } from 'vitest';

import { parseSomToTiyin, parseUsdToCents } from './payment';

describe('parseSomToTiyin (SPEC §5.5, CLAUDE.md rule 6)', () => {
  it('converts a whole so’m amount to tiyin (×100)', () => {
    expect(parseSomToTiyin('12')).toBe(1_200);
    expect(parseSomToTiyin('500000')).toBe(50_000_000);
  });

  it('accepts thousands separators an admin might type', () => {
    expect(parseSomToTiyin('1 250 000')).toBe(125_000_000);
    expect(parseSomToTiyin("1'250'000")).toBe(125_000_000);
    expect(parseSomToTiyin('1_250_000')).toBe(125_000_000);
  });

  it('rejects zero and negative amounts', () => {
    expect(parseSomToTiyin('0')).toBeNull();
    expect(parseSomToTiyin('-5')).toBeNull();
  });

  it('rejects decimals (payments are whole so’m)', () => {
    expect(parseSomToTiyin('1.5')).toBeNull();
    expect(parseSomToTiyin('100,50')).toBeNull();
  });

  it('rejects non-numeric and empty input', () => {
    expect(parseSomToTiyin('abc')).toBeNull();
    expect(parseSomToTiyin('')).toBeNull();
    expect(parseSomToTiyin('   ')).toBeNull();
  });

  it('rejects an unsafe magnitude', () => {
    expect(parseSomToTiyin('9'.repeat(20))).toBeNull();
  });
});

describe('parseUsdToCents (SPEC §7.4 USD tariffs)', () => {
  it('converts dollars (up to 2 decimals) to cents', () => {
    expect(parseUsdToCents('3')).toBe(300);
    expect(parseUsdToCents('3.5')).toBe(350);
    expect(parseUsdToCents('3.55')).toBe(355);
  });

  it('accepts a comma decimal mark and separators', () => {
    expect(parseUsdToCents('3,55')).toBe(355);
    expect(parseUsdToCents('1 200')).toBe(120_000);
  });

  it('rejects >2 decimals, zero, negatives and non-numeric', () => {
    expect(parseUsdToCents('1.234')).toBeNull();
    expect(parseUsdToCents('0')).toBeNull();
    expect(parseUsdToCents('-1')).toBeNull();
    expect(parseUsdToCents('abc')).toBeNull();
    expect(parseUsdToCents('')).toBeNull();
  });
});

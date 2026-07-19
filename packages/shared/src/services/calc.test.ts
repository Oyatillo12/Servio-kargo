import { describe, expect, it } from 'vitest';

import { parseKgToGrams } from './calc';

describe('parseKgToGrams', () => {
  it('accepts a whole number', () => {
    expect(parseKgToGrams('3')).toBe(3000);
  });

  it('accepts a dot decimal', () => {
    expect(parseKgToGrams('3.2')).toBe(3200);
  });

  it('accepts a comma decimal', () => {
    expect(parseKgToGrams('3,2')).toBe(3200);
  });

  it('trims surrounding whitespace', () => {
    expect(parseKgToGrams('  1.5  ')).toBe(1500);
  });

  it('rounds sub-gram precision to the nearest gram', () => {
    expect(parseKgToGrams('1.2365')).toBe(1237);
  });

  it('accepts zero', () => {
    expect(parseKgToGrams('0')).toBe(0);
  });

  it('rejects empty / whitespace', () => {
    expect(parseKgToGrams('')).toBeNull();
    expect(parseKgToGrams('   ')).toBeNull();
  });

  it('rejects non-numeric text', () => {
    expect(parseKgToGrams('abc')).toBeNull();
    expect(parseKgToGrams('3kg')).toBeNull();
    expect(parseKgToGrams('1.2.3')).toBeNull();
  });

  it('rejects negative and signed input', () => {
    expect(parseKgToGrams('-2')).toBeNull();
    expect(parseKgToGrams('+2')).toBeNull();
  });

  it('rejects absurdly large weights', () => {
    expect(parseKgToGrams('100001')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';

import { priceForGrams } from './price';

describe('priceForGrams (SPEC §7.4)', () => {
  const PPK = 5_500_000; // 55 000 so'm/kg in tiyin

  it('computes price = round(grams * ppk / 1000)', () => {
    // 1000 g at 55 000 so'm/kg = 55 000 so'm = 5 500 000 tiyin
    expect(priceForGrams(1000, PPK)).toBe(5_500_000);
    // 1500 g = 82 500 so'm = 8 250 000 tiyin
    expect(priceForGrams(1500, PPK)).toBe(8_250_000);
  });

  it('rounds to the nearest tiyin', () => {
    // 333 g * 5_500_000 / 1000 = 1_831_500 exactly
    expect(priceForGrams(333, PPK)).toBe(1_831_500);
    // 1 g * 5_500_001 / 1000 = 5500.001 → 5500
    expect(priceForGrams(1, 5_500_001)).toBe(5500);
  });

  it('returns 0 for zero weight', () => {
    expect(priceForGrams(0, PPK)).toBe(0);
  });
});

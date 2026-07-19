import { describe, expect, it } from 'vitest';

import { computeTrackPrice, priceForGrams } from './price';

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

describe('computeTrackPrice — UZS (SPEC §7.4)', () => {
  const PPK = 5_500_000; // 55 000 so'm/kg in tiyin

  it('prices in tiyin with no USD fields', () => {
    const p = computeTrackPrice({
      weightGrams: 1500,
      pricePerKgMinor: PPK,
      currency: 'UZS',
      usdRateTiyin: null,
    });
    expect(p.priceTiyin).toBe(8_250_000); // 82 500 so'm
    expect(p.priceUsdCents).toBeNull();
    expect(p.usdRateUsed).toBeNull();
  });

  it('ignores any usd rate that is passed', () => {
    const p = computeTrackPrice({
      weightGrams: 1000,
      pricePerKgMinor: PPK,
      currency: 'UZS',
      usdRateTiyin: 1_280_000,
    });
    expect(p.priceTiyin).toBe(5_500_000);
    expect(p.usdRateUsed).toBeNull();
  });
});

describe('computeTrackPrice — USD + rate freeze (SPEC §7.4)', () => {
  const PPK_CENTS = 350; // 3.5 $/kg in cents
  const RATE = 1_280_000; // 12 800 so'm per 1 USD, in tiyin

  it('computes cents then freezes the som price via the rate', () => {
    const p = computeTrackPrice({
      weightGrams: 2000, // 2 kg → 7.00$
      pricePerKgMinor: PPK_CENTS,
      currency: 'USD',
      usdRateTiyin: RATE,
    });
    expect(p.priceUsdCents).toBe(700); // round(2000 * 350 / 1000)
    // 700 cents * 12 800 000 tiyin/USD... : round(700 * 1_280_000 / 100)
    expect(p.priceTiyin).toBe(8_960_000); // 89 600 so'm
    expect(p.usdRateUsed).toBe(RATE);
  });

  it('freezes usd_rate_used so a later kurs change never alters the som price', () => {
    const first = computeTrackPrice({
      weightGrams: 1000,
      pricePerKgMinor: PPK_CENTS,
      currency: 'USD',
      usdRateTiyin: RATE,
    });
    // The track stores first.priceTiyin + first.usdRateUsed. A later re-read of
    // the tenant rate does not re-price a frozen track: the stored figure stands.
    const laterTenantRate = 1_500_000; // kurs went up
    expect(first.usdRateUsed).toBe(RATE);
    expect(first.priceTiyin).toBe(Math.round((350 * RATE) / 100));
    // Recomputing with the NEW rate would differ — proving freeze matters.
    const recomputed = computeTrackPrice({
      weightGrams: 1000,
      pricePerKgMinor: PPK_CENTS,
      currency: 'USD',
      usdRateTiyin: laterTenantRate,
    });
    expect(recomputed.priceTiyin).not.toBe(first.priceTiyin);
  });

  it('throws when a USD tenant has no rate configured', () => {
    expect(() =>
      computeTrackPrice({
        weightGrams: 1000,
        pricePerKgMinor: PPK_CENTS,
        currency: 'USD',
        usdRateTiyin: null,
      }),
    ).toThrow();
  });
});

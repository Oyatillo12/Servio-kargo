import { describe, expect, it } from 'vitest';

import { computeTrackPrice } from './price';
import {
  DEFAULT_VOLUMETRIC_COEF,
  MAX_DIMENSION_CM,
  chargeableWeight,
  parseDimensionCm,
  parseDimensions,
  readDimensions,
  storedChargeableWeight,
  volumetricGrams,
} from './volumetric';

describe('volumetricGrams (SPEC §7.16)', () => {
  it('turns cm³ into grams at the tariff coefficient', () => {
    // 50×40×30 cm = 60 000 cm³ = 0.06 m³; × 167 kg/m³ = 10.02 kg
    expect(volumetricGrams(
      { lengthCm: 50, widthCm: 40, heightCm: 30 },
      DEFAULT_VOLUMETRIC_COEF,
    )).toBe(10_020);
    // A cubic metre at the standard coefficient is the coefficient itself.
    expect(volumetricGrams(
      { lengthCm: 100, widthCm: 100, heightCm: 100 },
      DEFAULT_VOLUMETRIC_COEF,
    )).toBe(167_000);
  });

  it('follows the coefficient — a road tariff charges more per m³', () => {
    const dims = { lengthCm: 100, widthCm: 100, heightCm: 100 };
    expect(volumetricGrams(dims, 200)).toBe(200_000);
    expect(volumetricGrams(dims, 333)).toBe(333_000);
  });

  it('rounds to whole grams', () => {
    // 11×11×11 = 1331 cm³ × 167 / 1000 = 222.277 g
    expect(volumetricGrams(
      { lengthCm: 11, widthCm: 11, heightCm: 11 },
      DEFAULT_VOLUMETRIC_COEF,
    )).toBe(222);
  });

  it('treats a non-positive or broken coefficient as no volumetric pricing', () => {
    const dims = { lengthCm: 50, widthCm: 40, heightCm: 30 };
    expect(volumetricGrams(dims, 0)).toBe(0);
    expect(volumetricGrams(dims, -167)).toBe(0);
    expect(volumetricGrams(dims, Number.NaN)).toBe(0);
  });
});

describe('readDimensions — all three or nothing (SPEC §7.16)', () => {
  it('accepts three whole positive sides', () => {
    expect(readDimensions(50, 40, 30)).toEqual({
      lengthCm: 50,
      widthCm: 40,
      heightCm: 30,
    });
  });

  it('refuses a half-measured parcel', () => {
    expect(readDimensions(50, 40, null)).toBeNull();
    expect(readDimensions(null, null, null)).toBeNull();
    expect(readDimensions(50, undefined, 30)).toBeNull();
  });

  it('refuses zero, negative, fractional and absurd sides', () => {
    expect(readDimensions(0, 40, 30)).toBeNull();
    expect(readDimensions(-1, 40, 30)).toBeNull();
    expect(readDimensions(50.5, 40, 30)).toBeNull();
    expect(readDimensions(MAX_DIMENSION_CM + 1, 40, 30)).toBeNull();
    expect(readDimensions(MAX_DIMENSION_CM, 40, 30)).not.toBeNull();
  });
});

describe('parseDimensionCm / parseDimensions (SPEC §3.9, §7.16)', () => {
  it('parses one side, rounding a typed decimal to whole cm', () => {
    expect(parseDimensionCm('50')).toBe(50);
    expect(parseDimensionCm(' 50 ')).toBe(50);
    expect(parseDimensionCm('50,4')).toBe(50);
    expect(parseDimensionCm('50.6')).toBe(51);
  });

  it('rejects what is not a side', () => {
    expect(parseDimensionCm('')).toBeNull();
    expect(parseDimensionCm('abc')).toBeNull();
    expect(parseDimensionCm('-5')).toBeNull();
    expect(parseDimensionCm('0')).toBeNull();
    expect(parseDimensionCm('9000')).toBeNull();
  });

  it('accepts every separator a customer might type', () => {
    const expected = { lengthCm: 50, widthCm: 40, heightCm: 30 };
    expect(parseDimensions('50x40x30')).toEqual(expected);
    expect(parseDimensions('50X40X30')).toEqual(expected);
    expect(parseDimensions('50*40*30')).toEqual(expected);
    expect(parseDimensions('50 40 30')).toEqual(expected);
    expect(parseDimensions('50×40×30')).toEqual(expected);
    // Cyrillic х — the key next to the Latin one on a phone keyboard.
    expect(parseDimensions('50х40х30')).toEqual(expected);
    expect(parseDimensions(' 50 x 40 x 30 ')).toEqual(expected);
  });

  it('needs exactly three sides', () => {
    expect(parseDimensions('50x40')).toBeNull();
    expect(parseDimensions('50x40x30x20')).toBeNull();
    expect(parseDimensions('3.2')).toBeNull();
    expect(parseDimensions('')).toBeNull();
  });
});

describe('chargeableWeight (SPEC §7.16)', () => {
  const DIMS = { lengthCm: 50, widthCm: 40, heightCm: 30 }; // 10 020 g at 167

  it('NO REGRESSION: without dimensions the actual weight is charged', () => {
    const c = chargeableWeight(5_200, null, DEFAULT_VOLUMETRIC_COEF);
    expect(c.grams).toBe(5_200);
    expect(c.volumetricGrams).toBeNull();
    expect(c.basis).toBe('actual');
  });

  it('charges volume when a light parcel takes space', () => {
    const c = chargeableWeight(5_200, DIMS, DEFAULT_VOLUMETRIC_COEF);
    expect(c.grams).toBe(10_020);
    expect(c.volumetricGrams).toBe(10_020);
    expect(c.basis).toBe('volumetric');
  });

  it('charges the scale when a dense parcel outweighs its volume', () => {
    const c = chargeableWeight(25_000, DIMS, DEFAULT_VOLUMETRIC_COEF);
    expect(c.grams).toBe(25_000);
    // The volumetric figure is still reported — it is what gets frozen.
    expect(c.volumetricGrams).toBe(10_020);
    expect(c.basis).toBe('actual');
  });

  it('counts a tie as actual — "hajmiy" must not appear where it changed nothing', () => {
    const c = chargeableWeight(10_020, DIMS, DEFAULT_VOLUMETRIC_COEF);
    expect(c.grams).toBe(10_020);
    expect(c.basis).toBe('actual');
  });

  it('falls back to the scale when the tariff has no usable coefficient', () => {
    expect(chargeableWeight(5_200, DIMS, null).grams).toBe(5_200);
    expect(chargeableWeight(5_200, DIMS, 0).basis).toBe('actual');
    expect(chargeableWeight(5_200, DIMS, 0).volumetricGrams).toBeNull();
  });
});

describe('storedChargeableWeight — display reads frozen columns (SPEC §7.16)', () => {
  it('reports the frozen volumetric weight, not a recomputation', () => {
    const c = storedChargeableWeight(5_200, 10_020);
    expect(c).toEqual({
      grams: 10_020,
      volumetricGrams: 10_020,
      basis: 'volumetric',
    });
  });

  it('reads a track with no volumetric column as plain weight', () => {
    expect(storedChargeableWeight(5_200, null)).toEqual({
      grams: 5_200,
      volumetricGrams: null,
      basis: 'actual',
    });
  });

  it('is null for an unweighed track', () => {
    expect(storedChargeableWeight(null, 10_020)).toBeNull();
  });

  it('keeps the basis honest when the scale later won', () => {
    // Re-weighed heavier without changing the box: volume no longer decides.
    const c = storedChargeableWeight(25_000, 10_020);
    expect(c?.grams).toBe(25_000);
    expect(c?.basis).toBe('actual');
  });
});

describe('volumetric × pricing (SPEC §7.4 + §7.16)', () => {
  const PPK = 5_500_000; // 55 000 so'm/kg in tiyin

  it('prices the chargeable weight, not the scale reading', () => {
    const c = chargeableWeight(
      5_200,
      { lengthCm: 50, widthCm: 40, heightCm: 30 },
      DEFAULT_VOLUMETRIC_COEF,
    );
    const price = computeTrackPrice({
      weightGrams: c.grams,
      pricePerKgMinor: PPK,
      currency: 'UZS',
      usdRateTiyin: null,
    });
    // 10.02 kg × 55 000 = 551 100 so'm
    expect(price.priceTiyin).toBe(55_110_000);
  });

  it('leaves a dimensionless parcel priced exactly as before', () => {
    const c = chargeableWeight(5_200, null, DEFAULT_VOLUMETRIC_COEF);
    const withVolumetric = computeTrackPrice({
      weightGrams: c.grams,
      pricePerKgMinor: PPK,
      currency: 'UZS',
      usdRateTiyin: null,
    });
    const asBefore = computeTrackPrice({
      weightGrams: 5_200,
      pricePerKgMinor: PPK,
      currency: 'UZS',
      usdRateTiyin: null,
    });
    expect(withVolumetric).toEqual(asBefore);
  });

  it('carries through the USD path, freezing the kurs on the chargeable weight', () => {
    const c = chargeableWeight(
      5_200,
      { lengthCm: 50, widthCm: 40, heightCm: 30 },
      DEFAULT_VOLUMETRIC_COEF,
    );
    const price = computeTrackPrice({
      weightGrams: c.grams,
      pricePerKgMinor: 350, // $3.50/kg in cents
      currency: 'USD',
      usdRateTiyin: 1_270_000, // 12 700 so'm per $
    });
    // 10.02 kg × 350 = 3507 cents; × 12 700 so'm = 445 389 so'm
    expect(price.priceUsdCents).toBe(3_507);
    expect(price.priceTiyin).toBe(44_538_900);
    expect(price.usdRateUsed).toBe(1_270_000);
  });
});

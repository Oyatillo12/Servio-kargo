/**
 * Volumetric weight (SPEC §7.16 — D-005, D-007).
 *
 * A cubic metre of pillows and a cubic metre of phone cases cost the carrier
 * the same space, so a parcel is priced by the LARGER of what it weighs and
 * what it occupies. This module owns that comparison for every surface that
 * prices anything: the /weigh console, the bot's staff mode, the track page,
 * import, and both calculators.
 *
 * Two rules carry most of the weight here:
 *  - **No dimensions → nothing changes.** A tenant that never types a
 *    dimension prices exactly as it did before this module existed, which is
 *    what makes rolling volumetric pricing out to live tenants safe.
 *  - **A tie counts as actual.** "Hajmiy" is a claim about why the customer is
 *    paying more; it must not appear where it changed nothing.
 *
 * Pure and framework-free — grams and centimetres in, grams out.
 */

/** The 1:6000 air-freight standard, in kg per m³ (§7.16). */
export const DEFAULT_VOLUMETRIC_COEF = 167;

/**
 * Sanity bound per side, in cm. Five metres is past anything a cargo company
 * moves in a box; beyond it we are reading a typo, not a parcel.
 */
export const MAX_DIMENSION_CM = 500;

/** A parcel's three sides, in whole centimetres. Only meaningful together. */
export interface Dimensions {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

/** What the price was actually built on. */
export type WeightBasis = 'actual' | 'volumetric';

export interface ChargeableWeight {
  /** The grams that multiply the tariff (§7.4). */
  grams: number;
  /** The volumetric figure, or null when there were no usable dimensions. */
  volumetricGrams: number | null;
  /** Which of the two won. A tie is `actual` — see the module note. */
  basis: WeightBasis;
}

/**
 * Is this a usable side length? Whole positive centimetres within the sanity
 * bound. Rejecting rather than clamping is deliberate: a silently clamped 9000
 * would price a parcel nobody measured.
 */
export function isValidDimensionCm(value: number): boolean {
  return (
    Number.isInteger(value) && value > 0 && value <= MAX_DIMENSION_CM
  );
}

/**
 * Build `Dimensions` from three optional inputs — all three or nothing (§7.16).
 * Returns null when any side is missing or unusable, so a half-measured parcel
 * can never reach the pricing path.
 */
export function readDimensions(
  lengthCm: number | null | undefined,
  widthCm: number | null | undefined,
  heightCm: number | null | undefined,
): Dimensions | null {
  if (lengthCm == null || widthCm == null || heightCm == null) return null;
  if (
    !isValidDimensionCm(lengthCm) ||
    !isValidDimensionCm(widthCm) ||
    !isValidDimensionCm(heightCm)
  ) {
    return null;
  }
  return { lengthCm, widthCm, heightCm };
}

/**
 * Parse one typed side into whole centimetres, or null when it isn't one.
 * Accepts a decimal separator so `50,5` from a phone keyboard is not an error —
 * it rounds to the nearest centimetre, which is the precision a tape measure
 * against a cardboard box actually has.
 */
export function parseDimensionCm(input: string): number | null {
  const trimmed = input.trim().replace(',', '.');
  if (trimmed === '') return null;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const cm = Math.round(Number(trimmed));
  return isValidDimensionCm(cm) ? cm : null;
}

/**
 * Parse `50x40x30`, `50 40 30`, `50*40*30` or `50х40х30` (Cyrillic х — the key
 * next to the Latin one on every phone here) into dimensions. Customers mix
 * separators; the shape is what matters, and all three sides are required.
 */
export function parseDimensions(input: string): Dimensions | null {
  const parts = input
    .trim()
    .split(/[\s*×хx]+/i)
    .filter((p) => p !== '');
  if (parts.length !== 3) return null;

  const sides = parts.map(parseDimensionCm);
  const [lengthCm, widthCm, heightCm] = sides;
  return readDimensions(lengthCm, widthCm, heightCm);
}

/**
 * The weight a parcel's volume buys, in grams:
 * `L × W × H × coef / 1000`.
 *
 * The units collapse to one integer division: cm³ → m³ is ÷ 1 000 000, × coef
 * gives kg, × 1000 gives grams. No float touches the money path (rule 6).
 * A non-positive coefficient means "no volumetric pricing" and yields 0, so a
 * misconfigured tariff can never make a parcel cheaper OR dearer than its
 * scale reading.
 */
export function volumetricGrams(dims: Dimensions, coefKgPerM3: number): number {
  if (!Number.isFinite(coefKgPerM3) || coefKgPerM3 <= 0) return 0;
  return Math.round(
    (dims.lengthCm * dims.widthCm * dims.heightCm * coefKgPerM3) / 1000,
  );
}

/**
 * What this parcel is charged for (§7.16): the larger of the scale reading and
 * the volume, with the scale winning ties.
 *
 * `dims` null (or the tariff's coefficient missing) reduces this to the actual
 * weight and a null volumetric figure — the no-regression path every existing
 * track takes.
 */
export function chargeableWeight(
  actualGrams: number,
  dims: Dimensions | null,
  coefKgPerM3: number | null | undefined,
): ChargeableWeight {
  if (dims == null || coefKgPerM3 == null) {
    return { grams: actualGrams, volumetricGrams: null, basis: 'actual' };
  }

  const volumetric = volumetricGrams(dims, coefKgPerM3);
  if (volumetric <= 0) {
    return { grams: actualGrams, volumetricGrams: null, basis: 'actual' };
  }

  return volumetric > actualGrams
    ? { grams: volumetric, volumetricGrams: volumetric, basis: 'volumetric' }
    : { grams: actualGrams, volumetricGrams: volumetric, basis: 'actual' };
}

/**
 * Read a track's stored columns back into a chargeable weight for DISPLAY,
 * without recomputing anything: `volumetric_grams` was frozen when the price
 * was written, so this is what the customer was actually charged for even if
 * the tariff's coefficient has been edited since (§7.16).
 */
export function storedChargeableWeight(
  actualGrams: number | null,
  storedVolumetricGrams: number | null,
): ChargeableWeight | null {
  if (actualGrams == null) return null;
  if (storedVolumetricGrams == null || storedVolumetricGrams <= 0) {
    return { grams: actualGrams, volumetricGrams: null, basis: 'actual' };
  }
  return storedVolumetricGrams > actualGrams
    ? {
        grams: storedVolumetricGrams,
        volumetricGrams: storedVolumetricGrams,
        basis: 'volumetric',
      }
    : {
        grams: actualGrams,
        volumetricGrams: storedVolumetricGrams,
        basis: 'actual',
      };
}

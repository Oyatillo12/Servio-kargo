/**
 * Weighing a parcel — the one rule set behind every weighing surface
 * (SPEC §3.8, §7.4; tasks.md W2).
 *
 * A parcel is weighed in two places: the bot's staff mode (`CODE 3.2` over
 * Telegram) and the panel's `/weigh` console. Telegram is blocked in China,
 * which is exactly where the weighing happens, so the console is the primary
 * surface and the bot is the fallback channel — and the two must never disagree
 * about what weighing a parcel DOES. This module is that agreement: given the
 * tenant's currency/tariff, the track as it stands, and whatever marka the
 * operator typed, it returns the complete plan. Both surfaces then only execute.
 *
 * Pure and framework-free; the DB work lives in each app's query layer.
 */

import type { TrackStatus } from '../status';
import { computeTrackPrice, type Currency } from './price';
import { planStaffWeighing } from './staff';
import {
  chargeableWeight,
  type Dimensions,
  type WeightBasis,
} from './volumetric';

/** §7.13 cap for the stored box marking; a client code is far shorter. */
export const MAX_MARKA_LENGTH = 32;

/** Why a weighing cannot be priced. Both are tenant misconfigurations (§7.4). */
export type WeighRejection =
  /** The tenant has no default tariff, so there is no price per kg. */
  | 'NO_TARIFF'
  /** A USD tenant with no kurs set — the som figure cannot be frozen. */
  | 'NO_RATE';

/**
 * What the typed marka (the customer's `client_code`, written on the parcel)
 * did to this parcel's ownership.
 *
 * `conflict` is deliberately NOT a reassignment: the weight and price still get
 * written, the existing owner is left alone, and the operator is told. A mistyped
 * marka must never move a parcel — and its debt — onto the wrong person, and the
 * moment to notice is while the box is still in your hands.
 */
export type MarkaOutcome =
  /** No marka typed — ownership untouched. */
  | { kind: 'none' }
  /** The parcel had no owner and now has one. */
  | { kind: 'attached'; customerId: string }
  /** It already belonged to exactly this customer — nothing to write. */
  | { kind: 'alreadyOwned' }
  /** It belongs to somebody else. Left as it was; the operator is warned. */
  | { kind: 'conflict' }
  /** No customer of this tenant answers to that marka. Not an error (W2). */
  | { kind: 'notFound' };

/** How a marka resolved, as a bare tag — what the UI and event meta carry. */
export type MarkaOutcomeKind = MarkaOutcome['kind'];

/** The track a code already resolves to, as far as weighing cares. */
export interface WeighTrackState {
  currentStatus: TrackStatus;
  customerId: string | null;
  /**
   * Dimensions already stored on the track (§7.16). Read so that re-weighing a
   * measured parcel without retyping its sides still prices by volume — the
   * bot's staff line cannot carry dimensions at all (D-007), and it must not
   * quietly produce a cheaper price than the console did for the same box.
   */
  dimensions?: Dimensions | null;
}

export interface WeighInput {
  currency: Currency;
  /** Som per 1 USD in tiyin. Required when `currency` is 'USD'. */
  usdRateTiyin: number | null;
  /** The tenant's default tariff, or null when none is configured. */
  tariff: {
    id: string;
    pricePerKgMinor: number;
    /** kg per m³ (§7.16); absent/null disables volumetric pricing. */
    volumetricCoef?: number | null;
  } | null;
  /** Integer grams (CLAUDE.md rule 6) — what the scale said, always. */
  weightGrams: number;
  /**
   * Dimensions typed at this weighing, or null when none were (§7.16). Null
   * does NOT clear stored ones — an empty field never erases evidence, the
   * same rule marka follows.
   */
  dimensions?: Dimensions | null;
  /** The existing track, or null when the code is unknown and will be created. */
  track: WeighTrackState | null;
  /** Whether a marka was typed at all — separates "none" from "not found". */
  markaTyped: boolean;
  /** The customer that marka resolved to, or null when it matched nobody. */
  markaCustomerId: string | null;
  /** The marka exactly as typed, or null — becomes the box evidence (§7.13). */
  markaRaw?: string | null;
}

/**
 * The pricing columns a weighing writes. Always the auto path (§7.4).
 *
 * Column-shaped on purpose: both query layers spread this straight into the
 * insert/update, so every key here is a `tracks` column and nothing else is.
 * The dimension keys are OPTIONAL rather than nullable — omitted when none were
 * typed, because a spread of `lengthCm: null` would clear stored evidence
 * (§7.16), which is precisely what an empty field must never do.
 */
export interface WeighPricing {
  weightGrams: number;
  tariffId: string | null;
  priceTiyin: number;
  priceUsdCents: number | null;
  usdRateUsed: number | null;
  /** Weighing is auto-pricing, so it clears any earlier manual override. */
  priceManual: false;
  /** The volumetric weight frozen onto the track, or null (§7.16). */
  volumetricGrams: number | null;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
}

export interface WeighEffects {
  ok: true;
  /** Insert the track (the code was unknown) rather than update one. */
  create: boolean;
  pricing: WeighPricing;
  /** Status after the write — CHINA_WAREHOUSE for a new or CREATED parcel. */
  newStatus: TrackStatus;
  /** Append a `track_events` row for the status move (CLAUDE.md rule 7). */
  willEvent: boolean;
  /** Enqueue a §4.2 notification. */
  willNotify: boolean;
  /** Write this owner onto the track, or null to leave ownership alone. */
  attachCustomerId: string | null;
  /** Who the notification is for — the existing owner, or the fresh attach. */
  notifyCustomerId: string | null;
  marka: MarkaOutcome;
  /** The grams that multiplied the tariff — actual or volumetric (§7.16). */
  chargeableGrams: number;
  /** Which of the two won, so the operator is told when volume decided. */
  basis: WeightBasis;
  /**
   * Write this string into `tracks.marka` (§7.13), or null to leave the column
   * alone. Set whenever a non-empty marka was typed — whatever it resolved to:
   * on a `conflict`, "the box says DK-1042" is exactly the evidence a dispute
   * needs. Never an empty string, so an empty field never clears a stored one.
   */
  storeMarka: string | null;
}

export type WeighPlan = { ok: false; reason: WeighRejection } | WeighEffects;

/** Decide what the typed marka does, given who owns the parcel now. */
function planMarka(input: WeighInput): {
  marka: MarkaOutcome;
  attachCustomerId: string | null;
} {
  if (!input.markaTyped) {
    return { marka: { kind: 'none' }, attachCustomerId: null };
  }
  if (input.markaCustomerId == null) {
    return { marka: { kind: 'notFound' }, attachCustomerId: null };
  }

  const owner = input.track?.customerId ?? null;
  if (owner == null) {
    return {
      marka: { kind: 'attached', customerId: input.markaCustomerId },
      attachCustomerId: input.markaCustomerId,
    };
  }
  if (owner === input.markaCustomerId) {
    return { marka: { kind: 'alreadyOwned' }, attachCustomerId: null };
  }
  return { marka: { kind: 'conflict' }, attachCustomerId: null };
}

/**
 * Plan a weighing (SPEC §3.8): weight → price via the tenant's default tariff,
 * a CREATED parcel advances to CHINA_WAREHOUSE with an audit event and — when it
 * has an owner — a notification, and an unknown code is created unattached and
 * already at the China warehouse so the customer can claim it later.
 *
 * Since I1 the price is built on the CHARGEABLE weight (§7.16) — volume wins
 * over the scale for a light bulky parcel — while `weight_grams` keeps holding
 * what the scale said. Dimensions typed here win; typing none keeps the stored
 * ones and prices with them.
 *
 * On top of that, W2's addition: a marka resolves an unowned parcel to its
 * customer right there at intake. A newly attached owner is notified about the
 * status move, because the notification is about the parcel ARRIVING — they are
 * attached at the instant the event is written, and hearing "your parcel reached
 * the China warehouse" is the entire point of writing the marka on the box.
 * (Attaching on its own still never notifies — see `assignCustomer.ts`.)
 */
export function planWeighEntry(input: WeighInput): WeighPlan {
  // §7.4: a USD tenant with no kurs cannot freeze a som price, and no tariff
  // means no price per kg. Both are refusals, not a silently-zero price — a
  // parcel written down as costing nothing is a debt nobody ever collects.
  if (input.currency === 'USD' && input.usdRateTiyin == null) {
    return { ok: false, reason: 'NO_RATE' };
  }
  if (input.tariff == null) {
    return { ok: false, reason: 'NO_TARIFF' };
  }

  // §7.16: the tariff multiplies the chargeable weight. Typed dimensions win
  // over stored ones (the box is in the operator's hands); typing none keeps
  // what the track already knows, so the two surfaces never disagree on price.
  const effectiveDims = input.dimensions ?? input.track?.dimensions ?? null;
  const chargeable = chargeableWeight(
    input.weightGrams,
    effectiveDims,
    input.tariff.volumetricCoef ?? null,
  );

  const price = computeTrackPrice({
    weightGrams: chargeable.grams,
    pricePerKgMinor: input.tariff.pricePerKgMinor,
    currency: input.currency,
    usdRateTiyin: input.usdRateTiyin,
  });
  const pricing: WeighPricing = {
    // The scale reading, never the chargeable figure (§7.16).
    weightGrams: input.weightGrams,
    tariffId: input.tariff.id,
    priceTiyin: price.priceTiyin,
    priceUsdCents: price.priceUsdCents,
    usdRateUsed: price.usdRateUsed,
    priceManual: false,
    volumetricGrams: chargeable.volumetricGrams,
    ...(input.dimensions != null
      ? {
          lengthCm: input.dimensions.lengthCm,
          widthCm: input.dimensions.widthCm,
          heightCm: input.dimensions.heightCm,
        }
      : {}),
  };

  const { marka, attachCustomerId } = planMarka(input);
  // §7.13: the typed string is evidence of what the box says, kept regardless
  // of how (or whether) it resolved to a customer. Truncated to the cap, never
  // refused — a refusal mid-shift at a scanner is worse than short evidence.
  const storeMarka = input.markaTyped
    ? (input.markaRaw?.trim().slice(0, MAX_MARKA_LENGTH) || null)
    : null;

  // Unknown code → a brand-new parcel, straight into CHINA_WAREHOUSE.
  if (input.track == null) {
    return {
      ok: true,
      create: true,
      pricing,
      newStatus: 'CHINA_WAREHOUSE',
      willEvent: true,
      willNotify: attachCustomerId != null,
      attachCustomerId,
      notifyCustomerId: attachCustomerId,
      marka,
      chargeableGrams: chargeable.grams,
      basis: chargeable.basis,
      storeMarka,
    };
  }

  // Existing parcel: the status rule is `planStaffWeighing`, unchanged — but it
  // reads the owner AFTER this write, so a marka attached in the same breath
  // gets the arrival message.
  const effectiveCustomerId = attachCustomerId ?? input.track.customerId;
  const plan = planStaffWeighing({
    currentStatus: input.track.currentStatus,
    customerId: effectiveCustomerId,
  });

  return {
    ok: true,
    create: false,
    pricing,
    newStatus: plan.newStatus,
    willEvent: plan.willEvent,
    willNotify: plan.willNotify,
    attachCustomerId,
    notifyCustomerId: plan.willNotify ? effectiveCustomerId : null,
    marka,
    chargeableGrams: chargeable.grams,
    basis: chargeable.basis,
    storeMarka,
  };
}

/**
 * Calculator flow (SPEC §3.9, §4.5, §3.11). 🧮 → inline active-tariff buttons →
 * ask weight → ask dimensions (skippable) → reply an estimated price. Never
 * writes anything to the DB.
 *
 * All three steps are labelled `1/3` … `3/3` and every one of them carries a
 * cancel button: the flow hijacks the next plain message the customer sends,
 * and without a visible exit a mistyped trek code silently became a weight.
 *
 * The dimensions step is optional by design (D-007): skipping it prices pure kg
 * exactly as the two-step flow always did, so a customer who has no tape
 * measure loses nothing. It exists because the same parcel is priced by volume
 * at the warehouse (§7.16), and a quote that ignores volume is a quote the
 * customer will dispute at the counter.
 */

import {
  chargeableWeight,
  computeTrackPrice,
  formatKg,
  formatSom,
  formatUsd,
  parseDimensions,
  parseKgToGrams,
} from '@kargotrack/shared';

import type { KargoContext } from '../context';
import {
  calcResultKeyboard,
  calcSkipDimsKeyboard,
  calcTariffsKeyboard,
  cancelKeyboard,
} from '../keyboards';
import { miniAppUrlFor } from '../miniApp';
import { getActiveTariffs } from '../queries';

/** Clear any pending calculator state on the session. */
export function resetCalc(ctx: KargoContext): void {
  ctx.session.step = undefined;
  ctx.session.calcTariffId = undefined;
  ctx.session.calcRetried = undefined;
  ctx.session.calcGrams = undefined;
}

/** 🧮 Calculator — offer the tenant's active tariffs (SPEC §3.9). */
export async function showCalculator(ctx: KargoContext): Promise<void> {
  resetCalc(ctx);
  const tariffs = await getActiveTariffs(ctx.tenant.id);
  if (tariffs.length === 0) {
    // No tariffs to price against — a config gap, not a user mistake.
    await ctx.reply(ctx.s.calcNoTariffs);
    return;
  }
  await ctx.reply(ctx.s.calcStepTariff, {
    reply_markup: calcTariffsKeyboard(tariffs, ctx.s),
  });
}

/** `calc:restart` — re-run the calculator from the result message (§3.11). */
export async function calcRestartCallback(ctx: KargoContext): Promise<void> {
  await ctx.answerCallbackQuery();
  await showCalculator(ctx);
}

/** `calc:{tariffId}` inline callback — remember the tariff, ask for a weight. */
export async function calcTariffCallback(ctx: KargoContext): Promise<void> {
  const tariffId = ctx.match?.[1];
  if (!tariffId) {
    await ctx.answerCallbackQuery();
    return;
  }
  if (tariffId === 'restart') return calcRestartCallback(ctx);

  await ctx.answerCallbackQuery();
  ctx.session.calcTariffId = tariffId;
  ctx.session.calcRetried = false;
  ctx.session.step = 'awaiting_calc_kg';
  await ctx.reply(ctx.s.calcStepKg, { reply_markup: cancelKeyboard(ctx.s) });
}

/** `calc:skipdims` — price the typed weight alone (§3.9, D-007). */
export async function calcSkipDimsCallback(ctx: KargoContext): Promise<void> {
  await ctx.answerCallbackQuery();
  const grams = ctx.session.calcGrams;
  if (grams == null) {
    // The session was pruned or the button pressed twice — start over rather
    // than answer with a weight we no longer have.
    await showCalculator(ctx);
    return;
  }
  await replyWithPrice(ctx, grams, null);
}

/**
 * Handle the weight message while awaiting a calculator input. Invalid number →
 * re-ask once with a hint (§3.9); a second bad input gives up (caller falls
 * through to the normal lookup). Returns whether the input was consumed.
 */
export async function handleCalcWeight(
  ctx: KargoContext,
  text: string,
): Promise<boolean> {
  const grams = parseKgToGrams(text);
  if (grams == null) {
    if (!ctx.session.calcRetried) {
      ctx.session.calcRetried = true;
      await ctx.reply(ctx.s.calcInvalid, {
        reply_markup: cancelKeyboard(ctx.s),
      });
      return true; // keep waiting for a corrected number
    }
    resetCalc(ctx);
    return false; // give up — let the caller treat it as a normal message
  }

  // Step 3: dimensions, offered but never required.
  ctx.session.calcGrams = grams;
  ctx.session.calcRetried = false;
  ctx.session.step = 'awaiting_calc_dims';
  await ctx.reply(ctx.s.calcStepDims, {
    reply_markup: calcSkipDimsKeyboard(ctx.s),
  });
  return true;
}

/**
 * Handle the dimensions message (§7.16). Unreadable input → re-ask once, then
 * fall back to pricing the weight alone rather than stranding the customer
 * mid-flow: they asked for a price, and a price is what they get.
 */
export async function handleCalcDims(
  ctx: KargoContext,
  text: string,
): Promise<boolean> {
  const grams = ctx.session.calcGrams;
  if (grams == null) {
    resetCalc(ctx);
    return false;
  }

  const dims = parseDimensions(text);
  if (dims == null) {
    if (!ctx.session.calcRetried) {
      ctx.session.calcRetried = true;
      await ctx.reply(ctx.s.calcDimsInvalid, {
        reply_markup: calcSkipDimsKeyboard(ctx.s),
      });
      return true;
    }
    await replyWithPrice(ctx, grams, null);
    return true;
  }

  await replyWithPrice(ctx, grams, dims);
  return true;
}

/** Price the collected weight (+ optional volume) and answer (§4.5). */
async function replyWithPrice(
  ctx: KargoContext,
  grams: number,
  dims: { lengthCm: number; widthCm: number; heightCm: number } | null,
): Promise<void> {
  const tariffId = ctx.session.calcTariffId;
  const tariffs = await getActiveTariffs(ctx.tenant.id);
  const tariff = tariffs.find((tf) => tf.id === tariffId);
  if (!tariff) {
    // Tariff vanished/deactivated mid-flow — restart the picker.
    resetCalc(ctx);
    await showCalculator(ctx);
    return;
  }

  const tn = ctx.tenant;
  // A USD tenant with no rate set can't be priced — say so honestly.
  if (tn.currency === 'USD' && tn.usdRateTiyin == null) {
    resetCalc(ctx);
    await ctx.reply(ctx.s.calcNoRate);
    return;
  }

  // §7.16: the same comparison the warehouse will make, so the quote and the
  // eventual bill come from one rule.
  const charged = chargeableWeight(grams, dims, tariff.volumetricCoef);
  const price = computeTrackPrice({
    weightGrams: charged.grams,
    pricePerKgMinor: tariff.pricePerKgMinor,
    currency: tn.currency,
    usdRateTiyin: tn.usdRateTiyin,
  });

  resetCalc(ctx);
  await ctx.reply(
    ctx.s.calcResult({
      tariffName: tariff.name,
      kg: formatKg(charged.grams),
      som: formatSom(price.priceTiyin),
      usd:
        price.priceUsdCents != null
          ? formatUsd(price.priceUsdCents)
          : undefined,
      // Present only when volume won — its presence is what switches the
      // answer to the "hajmiy" wording.
      actualKg: charged.basis === 'volumetric' ? formatKg(grams) : undefined,
    }),
    { reply_markup: calcResultKeyboard(ctx.s, miniAppUrlFor(ctx.tenant, 'calc')) },
  );
}

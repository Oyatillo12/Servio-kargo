/**
 * Calculator flow (SPEC §3.9, §4.5). 🧮 → inline active-tariff buttons → ask
 * weight → reply an estimated price. Never writes anything to the DB.
 */

import {
  computeTrackPrice,
  formatKg,
  formatSom,
  formatUsd,
  parseKgToGrams,
} from '@kargotrack/shared';

import type { KargoContext } from '../context';
import { calcTariffsKeyboard } from '../keyboards';
import { getActiveTariffs } from '../queries';

/** Clear any pending calculator state on the session. */
function resetCalc(ctx: KargoContext): void {
  ctx.session.step = undefined;
  ctx.session.calcTariffId = undefined;
  ctx.session.calcRetried = undefined;
}

/** 🧮 Kalkulyator — offer the tenant's active tariffs (SPEC §3.9). */
export async function showCalculator(ctx: KargoContext): Promise<void> {
  resetCalc(ctx);
  const tariffs = await getActiveTariffs(ctx.tenant.id);
  if (tariffs.length === 0) {
    // No tariffs to price against — nudge the user back to the menu.
    await ctx.reply(ctx.s.helpFallback);
    return;
  }
  await ctx.reply(ctx.s.calcChooseTariff, {
    reply_markup: calcTariffsKeyboard(tariffs),
  });
}

/** `calc:{tariffId}` inline callback — remember the tariff, ask for a weight. */
export async function calcTariffCallback(ctx: KargoContext): Promise<void> {
  await ctx.answerCallbackQuery();
  const tariffId = ctx.match?.[1];
  if (!tariffId) return;
  ctx.session.calcTariffId = tariffId;
  ctx.session.calcRetried = false;
  ctx.session.step = 'awaiting_calc_kg';
  await ctx.reply(ctx.s.calcAskKg);
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
      await ctx.reply(ctx.s.calcInvalid);
      return true; // keep waiting for a corrected number
    }
    resetCalc(ctx);
    return false; // give up — let the caller treat it as a normal message
  }

  const tariffId = ctx.session.calcTariffId;
  const tariffs = await getActiveTariffs(ctx.tenant.id);
  const tariff = tariffs.find((tf) => tf.id === tariffId);
  if (!tariff) {
    // Tariff vanished/deactivated mid-flow — restart the picker.
    resetCalc(ctx);
    await showCalculator(ctx);
    return true;
  }

  const tn = ctx.tenant;
  // A USD tenant with no kurs set can't be priced — treat like "no tariff".
  if (tn.currency === 'USD' && tn.usdRateTiyin == null) {
    resetCalc(ctx);
    await ctx.reply(ctx.s.helpFallback);
    return true;
  }
  const price = computeTrackPrice({
    weightGrams: grams,
    pricePerKgMinor: tariff.pricePerKgMinor,
    currency: tn.currency,
    usdRateTiyin: tn.usdRateTiyin,
  });

  resetCalc(ctx);
  await ctx.reply(
    ctx.s.calcResult({
      tariffName: tariff.name,
      kg: formatKg(grams),
      som: formatSom(price.priceTiyin),
      usd:
        price.priceUsdCents != null
          ? formatUsd(price.priceUsdCents)
          : undefined,
    }),
  );
  return true;
}

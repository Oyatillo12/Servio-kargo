/**
 * Calculator flow (SPEC §3.9, §4.5, §3.11). 🧮 → inline active-tariff buttons →
 * ask weight → reply an estimated price. Never writes anything to the DB.
 *
 * Both steps are labelled `1/2` / `2/2` and both carry a cancel button: the
 * flow hijacks the next plain message the customer sends, and without a visible
 * exit a mistyped trek code silently became a weight.
 */

import {
  computeTrackPrice,
  formatKg,
  formatSom,
  formatUsd,
  parseKgToGrams,
} from '@kargotrack/shared';

import type { KargoContext } from '../context';
import {
  calcResultKeyboard,
  calcTariffsKeyboard,
  cancelKeyboard,
} from '../keyboards';
import { getActiveTariffs } from '../queries';

/** Clear any pending calculator state on the session. */
export function resetCalc(ctx: KargoContext): void {
  ctx.session.step = undefined;
  ctx.session.calcTariffId = undefined;
  ctx.session.calcRetried = undefined;
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
  // A USD tenant with no rate set can't be priced — say so honestly.
  if (tn.currency === 'USD' && tn.usdRateTiyin == null) {
    resetCalc(ctx);
    await ctx.reply(ctx.s.calcNoRate);
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
    { reply_markup: calcResultKeyboard(ctx.s) },
  );
  return true;
}

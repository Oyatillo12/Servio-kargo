'use client';

/**
 * Live price estimate (tasks.md B5) — the same shared math the bot's /calc
 * and the weighing flow use (`parseKgToGrams` + `computeTrackPrice`), so all
 * three surfaces can never disagree on a price. Never writes anything.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import {
  computeTrackPrice,
  formatSom,
  formatUsd,
  parseKgToGrams,
  type Currency,
} from '@kargotrack/shared';

import type { TwaTariff } from '@/lib/twa/queries';

export function CalcClient({
  tariffs,
  currency,
  usdRateTiyin,
}: {
  tariffs: TwaTariff[];
  currency: Currency;
  usdRateTiyin: number | null;
}) {
  const t = useTranslations('twa');
  const tCommon = useTranslations('common');
  const [tariffId, setTariffId] = useState(tariffs[0]?.id ?? '');
  const [kgInput, setKgInput] = useState('');

  if (tariffs.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[#dfe3ea] px-4 py-10 text-center text-sm text-muted-foreground">
        {t('calcNoTariffs')}
      </p>
    );
  }

  const tariff = tariffs.find((tf) => tf.id === tariffId) ?? tariffs[0]!;
  const grams = kgInput.trim() ? parseKgToGrams(kgInput) : null;
  // USD tenants without a configured rate can't be priced in som — the same
  // rule weighing enforces; show nothing rather than a wrong number.
  const priced =
    grams != null && (currency === 'UZS' || usdRateTiyin != null)
      ? computeTrackPrice({
          weightGrams: grams,
          pricePerKgMinor: tariff.pricePerKgMinor,
          currency,
          usdRateTiyin,
        })
      : null;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[#eef0f4] bg-white px-4 py-3.5">
        <label
          htmlFor="tariff"
          className="mb-1 block text-[12.5px] font-medium text-muted-foreground"
        >
          {t('calcTariff')}
        </label>
        <select
          id="tariff"
          value={tariff.id}
          onChange={(e) => setTariffId(e.target.value)}
          className="w-full rounded-lg border border-[#dfe3ea] px-3 py-2.5 text-sm outline-none focus:border-slate-400"
        >
          {tariffs.map((tf) => (
            <option key={tf.id} value={tf.id}>
              {tf.name}
            </option>
          ))}
        </select>

        <label
          htmlFor="kg"
          className="mb-1 mt-3 block text-[12.5px] font-medium text-muted-foreground"
        >
          {t('calcKg')}
        </label>
        <input
          id="kg"
          inputMode="decimal"
          placeholder="2.5"
          value={kgInput}
          onChange={(e) => setKgInput(e.target.value)}
          className="w-full rounded-lg border border-[#dfe3ea] px-3 py-2.5 font-mono text-sm outline-none focus:border-slate-400"
        />
      </div>

      {kgInput.trim() === '' ? null : grams == null ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {t('calcInvalid')}
        </p>
      ) : priced ? (
        <div className="rounded-xl border border-[#eef0f4] bg-white px-4 py-4 text-center">
          <p className="text-[12.5px] text-muted-foreground">
            {t('calcResult')}
          </p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-foreground">
            {formatSom(priced.priceTiyin)} {tCommon('som')}
          </p>
          {priced.priceUsdCents != null ? (
            <p className="mt-0.5 font-mono text-sm text-muted-foreground">
              ≈ {formatUsd(priced.priceUsdCents)}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

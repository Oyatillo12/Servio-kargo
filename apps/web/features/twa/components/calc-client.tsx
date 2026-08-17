'use client';

/**
 * Live price estimate — the same shared math the bot's /calc and the
 * weighing flow use (`parseKgToGrams` + `computeTrackPrice`), so all three
 * surfaces can never disagree on a price. Never writes anything.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import {
  chargeableWeight,
  computeTrackPrice,
  formatKg,
  formatSom,
  formatUsd,
  parseDimensionCm,
  parseKgToGrams,
  readDimensions,
  type Currency,
} from '@kargotrack/shared';

import { haptic } from '@/lib/twa/client';
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
  /**
   * Dimensions (§7.16) — a closed block, like the bot's skippable third step
   * (D-007): most customers want "how much for 3 kg" and should not have to
   * scroll past three fields they will leave empty to get it.
   */
  const [dimsOpen, setDimsOpen] = useState(false);
  const [dims, setDims] = useState({ lengthCm: '', widthCm: '', heightCm: '' });

  if (tariffs.length === 0) {
    return (
      <p className="twa-hint twa-rise rounded-2xl border border-dashed px-4 py-10 text-center text-sm"
        style={{ borderColor: 'var(--twa-border)' }}
      >
        {t('calcNoTariffs')}
      </p>
    );
  }

  const tariff = tariffs.find((tf) => tf.id === tariffId) ?? tariffs[0]!;
  const grams = kgInput.trim() ? parseKgToGrams(kgInput) : null;

  // §7.16: quote what the warehouse will actually charge. Half-filled sides
  // simply don't count yet — this recomputes on every keystroke, so refusing
  // mid-typing would flash an error at somebody who is still typing.
  const parsedDims = dimsOpen
    ? readDimensions(
        parseDimensionCm(dims.lengthCm),
        parseDimensionCm(dims.widthCm),
        parseDimensionCm(dims.heightCm),
      )
    : null;
  const charged =
    grams != null
      ? chargeableWeight(grams, parsedDims, tariff.volumetricCoef)
      : null;

  // USD tenants without a configured rate can't be priced in som — the same
  // rule weighing enforces; show nothing rather than a wrong number.
  const priced =
    charged != null && (currency === 'UZS' || usdRateTiyin != null)
      ? computeTrackPrice({
          weightGrams: charged.grams,
          pricePerKgMinor: tariff.pricePerKgMinor,
          currency,
          usdRateTiyin,
        })
      : null;

  return (
    <div className="space-y-3">
      {tariffs.length > 1 ? (
        <div className="twa-rise flex flex-wrap gap-2">
          {tariffs.map((tf) => (
            <button
              key={tf.id}
              type="button"
              onClick={() => {
                haptic();
                setTariffId(tf.id);
              }}
              className="twa-press rounded-full px-3.5 py-2 text-small font-semibold"
              style={
                tf.id === tariff.id
                  ? { background: 'var(--twa-brand)', color: 'var(--twa-on-brand)' }
                  : {
                      background: 'var(--twa-card)',
                      color: 'var(--twa-text)',
                      border: '1px solid var(--twa-border)',
                    }
              }
            >
              {tf.name}
            </button>
          ))}
        </div>
      ) : null}

      <div className="twa-card twa-rise px-4 py-4" style={{ '--twa-i': 1 } as React.CSSProperties}>
        <label htmlFor="kg" className="twa-hint mb-1.5 block text-micro font-medium">
          {t('calcKg')}
        </label>
        <input
          id="kg"
          inputMode="decimal"
          placeholder="2.5"
          value={kgInput}
          onChange={(e) => setKgInput(e.target.value)}
          className="twa-input font-mono text-lg"
          autoComplete="off"
        />

        {dimsOpen ? (
          <div className="mt-3">
            <p className="twa-hint mb-1.5 text-micro font-medium">
              {t('calcDims')}
            </p>
            <div className="flex items-center gap-1.5">
              {(['lengthCm', 'widthCm', 'heightCm'] as const).map((side, i) => (
                <div
                  key={side}
                  className="flex min-w-0 flex-1 items-center gap-1.5"
                >
                  {i > 0 ? <span className="twa-hint text-sm">×</span> : null}
                  <input
                    inputMode="numeric"
                    placeholder={['50', '40', '30'][i]}
                    aria-label={
                      [t('calcDimLength'), t('calcDimWidth'), t('calcDimHeight')][i]
                    }
                    value={dims[side]}
                    onChange={(e) =>
                      setDims((d) => ({ ...d, [side]: e.target.value }))
                    }
                    className="twa-input min-w-0 flex-1 font-mono text-base"
                    autoComplete="off"
                  />
                </div>
              ))}
              <span className="twa-hint text-micro">{tCommon('cm')}</span>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              haptic();
              setDimsOpen(true);
            }}
            className="twa-press mt-2.5 text-small font-semibold"
            style={{ color: 'var(--twa-brand)' }}
          >
            + {t('calcDimsAdd')}
          </button>
        )}
      </div>

      {kgInput.trim() === '' ? null : grams == null ? (
        <p
          className="twa-rise rounded-xl px-4 py-3 text-sm"
          style={{ background: 'var(--twa-error-soft)', color: 'var(--twa-error)' }}
        >
          {t('calcInvalid')}
        </p>
      ) : priced ? (
        <div className="twa-card twa-rise px-4 py-5 text-center">
          <p className="twa-hint text-micro">{t('calcResult')}</p>
          {/* §7.16: a bigger number than the customer typed always arrives with
              its reason — the same line the bot and the track card use. */}
          {charged?.basis === 'volumetric' ? (
            <p
              className="mt-1 text-micro font-semibold"
              style={{ color: 'var(--twa-brand)' }}
            >
              {t('calcVolumetric', {
                kg: formatKg(charged.grams),
                actual: formatKg(grams ?? 0),
              })}
            </p>
          ) : null}
          <p className="mt-1 font-mono text-[28px] font-bold tabular-nums leading-none">
            {formatSom(priced.priceTiyin)}
            <span className="twa-hint ml-1.5 text-base font-semibold">
              {tCommon('som')}
            </span>
          </p>
          {priced.priceUsdCents != null ? (
            <p className="twa-hint mt-1.5 font-mono text-sm">
              ≈ {formatUsd(priced.priceUsdCents)}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

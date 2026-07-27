'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { setWeightAction } from '../detail-actions';

export interface TariffOption {
  id: string;
  label: string;
}

/**
 * Weight + tariff + price editor (SPEC §7.4). Auto mode recomputes price from
 * weight × tariff on save (server-side, currency-aware). The manual toggle
 * switches to a typed som price that suspends recompute.
 */
export function WeightForm({
  trackId,
  defaultWeight,
  tariffs,
  initialTariffId,
  initialManual,
  initialManualPriceSom,
  priceText,
  priceUsdText,
}: {
  trackId: string;
  defaultWeight: string;
  tariffs: TariffOption[];
  initialTariffId: string | null;
  initialManual: boolean;
  initialManualPriceSom: string;
  priceText: string;
  priceUsdText?: string;
}) {
  const t = useTranslations('trackDetail');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [saving, startSave] = useTransition();

  const [weight, setWeight] = useState(defaultWeight);
  const [tariffId, setTariffId] = useState<string>(
    initialTariffId ?? tariffs[0]?.id ?? '',
  );
  const [manual, setManual] = useState(initialManual);
  const [manualPrice, setManualPrice] = useState(initialManualPriceSom);

  function save() {
    startSave(async () => {
      const res = await setWeightAction({
        trackId,
        weight,
        tariffId: tariffId || null,
        priceManual: manual,
        manualPrice,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(tCommon('saved'));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2.5">
      <Label htmlFor="weight">{t('weight')}</Label>
      <div className="flex items-center overflow-hidden rounded-lg border border-input focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
        <input
          id="weight"
          inputMode="decimal"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          onKeyDown={(e) => {
            // Weighing is a two-hand job: scale in one, phone in the other.
            // Enter saves so the admin never has to reach for the button.
            if (e.key === 'Enter') {
              e.preventDefault();
              save();
            }
          }}
          placeholder="0"
          className="min-w-0 flex-1 bg-white px-3 py-2.5 font-mono text-[17px] font-semibold outline-none"
        />
        <span className="border-l border-border bg-[#f7f8fa] px-3.5 py-2.5 text-[13px] text-muted-foreground">
          {tCommon('kg')}
        </span>
      </div>

      {/* Tariff */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tariff">{t('tariff')}</Label>
        {tariffs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-input px-3 py-2 text-[12.5px] text-muted-foreground">
            {t('noTariff')}
          </p>
        ) : (
          <Select value={tariffId} onValueChange={setTariffId} disabled={manual}>
            <SelectTrigger id="tariff">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tariffs.map((tf) => (
                <SelectItem key={tf.id} value={tf.id}>
                  {tf.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Manual override */}
      <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border px-3 py-2">
        <span>
          <span className="block text-[13px] font-semibold">
            {t('manualToggle')}
          </span>
          <span className="block text-[11.5px] text-muted-foreground">
            {t('manualToggleHint')}
          </span>
        </span>
        <Switch checked={manual} onCheckedChange={setManual} />
      </label>

      {manual ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="manualPrice">{t('manualPrice')}</Label>
          <div className="flex items-center overflow-hidden rounded-lg border border-input focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
            <input
              id="manualPrice"
              inputMode="numeric"
              value={manualPrice}
              onChange={(e) => setManualPrice(e.target.value)}
              placeholder="0"
              className="min-w-0 flex-1 bg-white px-3 py-2.5 font-mono text-[17px] font-semibold outline-none"
            />
            <span className="border-l border-border bg-[#f7f8fa] px-3.5 py-2.5 text-[13px] text-muted-foreground">
              {tCommon('som')}
            </span>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] text-muted-foreground">
              {t('price')}
            </span>
            <span className="font-mono text-[17px] font-semibold text-primary">
              {priceText}
              {priceUsdText ? (
                <span className="ml-1.5 text-[13px] text-muted-foreground">
                  {priceUsdText}
                </span>
              ) : null}
            </span>
          </div>
          <p className="-mt-1 text-right text-[11.5px] text-muted-foreground">
            {t('priceAutoHint')}
          </p>
        </>
      )}

      <Button onClick={save} disabled={saving} className="w-full">
        {saving ? <Spinner /> : null}
        {tCommon('save')}
      </Button>
    </div>
  );
}

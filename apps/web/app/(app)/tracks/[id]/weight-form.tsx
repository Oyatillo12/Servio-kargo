'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { setWeightAction } from './actions';

export interface TariffOption {
  id: string;
  label: string;
}

/**
 * Weight + tariff + price editor (SPEC §7.4). Auto mode recomputes price from
 * weight × tariff on save (server-side, currency-aware). The `Qo'lda kiritish`
 * toggle switches to a manual som price that suspends recompute.
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
      toast.success('Saqlandi');
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2.5">
      <Label htmlFor="weight">Og&apos;irlik (kg)</Label>
      <div className="flex items-center overflow-hidden rounded-lg border border-input">
        <input
          id="weight"
          inputMode="decimal"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder="0"
          className="min-w-0 flex-1 bg-white px-3 py-2.5 font-mono text-[17px] font-semibold outline-none"
        />
        <span className="border-l border-border bg-[#f7f8fa] px-3.5 py-2.5 text-[13px] text-muted-foreground">
          kg
        </span>
      </div>

      {/* Tariff */}
      <div className="flex flex-col gap-1.5">
        <Label>Tarif</Label>
        {tariffs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-input px-3 py-2 text-[12.5px] text-muted-foreground">
            Tarif yo&apos;q — Sozlamalarda qo&apos;shing.
          </p>
        ) : (
          <Select value={tariffId} onValueChange={setTariffId} disabled={manual}>
            <SelectTrigger>
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
      <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
        <div>
          <p className="text-[13px] font-semibold">Qo&apos;lda kiritish</p>
          <p className="text-[11.5px] text-muted-foreground">
            Narxni qo&apos;lda belgilash
          </p>
        </div>
        <Switch checked={manual} onCheckedChange={setManual} />
      </div>

      {manual ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="manualPrice">Narx (so&apos;m)</Label>
          <div className="flex items-center overflow-hidden rounded-lg border border-input">
            <input
              id="manualPrice"
              inputMode="numeric"
              value={manualPrice}
              onChange={(e) => setManualPrice(e.target.value)}
              placeholder="0"
              className="min-w-0 flex-1 bg-white px-3 py-2.5 font-mono text-[17px] font-semibold outline-none"
            />
            <span className="border-l border-border bg-[#f7f8fa] px-3.5 py-2.5 text-[13px] text-muted-foreground">
              so&apos;m
            </span>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] text-muted-foreground">Narx</span>
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
            tarif × og&apos;irlik · avtomatik hisoblanadi
          </p>
        </>
      )}

      <Button onClick={save} disabled={saving} className="w-full">
        {saving ? 'Saqlanmoqda…' : 'Saqlash'}
      </Button>
    </div>
  );
}

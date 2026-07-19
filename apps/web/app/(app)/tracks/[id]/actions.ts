'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { parseSomToTiyin } from '@kargotrack/shared';

import { requireAdmin } from '@/lib/auth';
import { setTrackPricing } from '@/lib/queries';

export interface WeightState {
  error?: string;
  ok?: boolean;
}

// Weight in kg up to 2 decimals (SPEC §5.3); tariff + manual override (§7.4).
const schema = z.object({
  trackId: z.string().uuid(),
  weight: z.string(),
  tariffId: z.string().uuid().nullable().optional(),
  priceManual: z.boolean().optional(),
  manualPrice: z.string().optional(),
});

/**
 * Save a track's weight, tariff and price (SPEC §7.4). Auto mode recomputes from
 * weight × tariff under the tenant currency; manual mode stores the typed som
 * price and suspends recompute until toggled off.
 */
export async function setWeightAction(input: {
  trackId: string;
  weight: string;
  tariffId: string | null;
  priceManual: boolean;
  manualPrice: string;
}): Promise<WeightState> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: 'Xatolik yuz berdi.' };

  const { tenant } = await requireAdmin();
  const raw = parsed.data.weight.trim().replace(',', '.');

  let weightGrams: number | null = null;
  if (raw !== '') {
    const kg = Number(raw);
    if (!Number.isFinite(kg) || kg < 0 || kg > 100000) {
      return { error: "Og'irlik noto'g'ri kiritildi." };
    }
    if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
      return { error: "Og'irlikni kg da, 2 xonagacha kiriting (masalan 1.25)." };
    }
    weightGrams = Math.round(kg * 1000);
  }

  const priceManual = parsed.data.priceManual ?? false;

  // Manual mode with a weight needs a valid som price.
  let manualPriceTiyin: number | null = null;
  if (priceManual && weightGrams != null) {
    manualPriceTiyin = parseSomToTiyin(parsed.data.manualPrice ?? '');
    if (manualPriceTiyin == null) {
      return { error: "Narxni so'mda, butun musbat son kiriting." };
    }
  }

  const err = await setTrackPricing({
    tenantId: tenant.id,
    trackId: parsed.data.trackId,
    weightGrams,
    tariffId: parsed.data.tariffId ?? null,
    priceManual,
    manualPriceTiyin,
  });
  if (err === 'NO_TARIFF') {
    return { error: 'Avval Sozlamalarda tarif qo‘shing.' };
  }
  if (err === 'NO_RATE') {
    return { error: 'USD rejimi uchun Sozlamalarda kursni kiriting.' };
  }

  revalidatePath(`/tracks/${parsed.data.trackId}`);
  return { ok: true };
}

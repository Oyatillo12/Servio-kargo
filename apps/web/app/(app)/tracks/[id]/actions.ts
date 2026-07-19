'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { priceForGrams } from '@kargotrack/shared';

import { requireAdmin } from '@/lib/auth';
import { setTrackWeight } from '@/lib/queries';

export interface WeightState {
  error?: string;
  ok?: boolean;
}

// Weight in kg, up to 2 decimals (SPEC §5.3). Empty clears weight + price.
const schema = z.object({
  trackId: z.string().uuid(),
  weight: z.string(),
});

export async function setWeightAction(
  _prev: WeightState,
  formData: FormData,
): Promise<WeightState> {
  const parsed = schema.safeParse({
    trackId: formData.get('trackId'),
    weight: formData.get('weight'),
  });
  if (!parsed.success) return { error: 'Xatolik yuz berdi.' };

  const { tenant } = await requireAdmin();
  const raw = parsed.data.weight.trim().replace(',', '.');

  let weightGrams: number | null = null;
  let priceTiyin: number | null = null;

  if (raw !== '') {
    const kg = Number(raw);
    if (!Number.isFinite(kg) || kg < 0 || kg > 100000) {
      return { error: "Og'irlik noto'g'ri kiritildi." };
    }
    // Guard against more than 2 decimals (kg → grams must be an integer).
    if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
      return { error: "Og'irlikni kg da, 2 xonagacha kiriting (masalan 1.25)." };
    }
    weightGrams = Math.round(kg * 1000);
    priceTiyin = priceForGrams(weightGrams, tenant.pricePerKgTiyin);
  }

  await setTrackWeight({
    tenantId: tenant.id,
    trackId: parsed.data.trackId,
    weightGrams,
    priceTiyin,
  });

  revalidatePath(`/tracks/${parsed.data.trackId}`);
  return { ok: true };
}

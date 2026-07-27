'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';

import { parseSomToTiyin } from '@kargotrack/shared';

import { requireAdmin } from '@/lib/auth';
import { setTrackPricing, setTracksCustomer } from '@/lib/queries';

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
  const t = await getTranslations('trackDetail');

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { error: (await getTranslations('common'))('errorGeneric') };
  }

  const { tenant } = await requireAdmin();
  const raw = parsed.data.weight.trim().replace(',', '.');

  let weightGrams: number | null = null;
  if (raw !== '') {
    const kg = Number(raw);
    if (!Number.isFinite(kg) || kg < 0 || kg > 100000) {
      return { error: t('invalidWeight') };
    }
    if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
      return { error: t('invalidWeightFormat') };
    }
    weightGrams = Math.round(kg * 1000);
  }

  const priceManual = parsed.data.priceManual ?? false;

  // Manual mode with a weight needs a valid som price.
  let manualPriceTiyin: number | null = null;
  if (priceManual && weightGrams != null) {
    manualPriceTiyin = parseSomToTiyin(parsed.data.manualPrice ?? '');
    if (manualPriceTiyin == null) {
      return { error: t('invalidManualPrice') };
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
  if (err === 'NO_TARIFF') return { error: t('noTariffConfigured') };
  if (err === 'NO_RATE') return { error: t('noUsdRate') };

  revalidatePath(`/tracks/${parsed.data.trackId}`);
  return { ok: true };
}

// --- Customer assignment (SPEC §5.3, §7.3) ----------------------------------

export interface AssignCustomerState {
  ok?: boolean;
  error?: string;
}

const attachSchema = z.object({
  trackId: z.string().uuid(),
  customerId: z.string().uuid(),
});

/**
 * Attach this track to a customer, or move it from the customer who claimed it
 * by mistake (SPEC §7.3). Tenant-scoped: `setTracksCustomer` re-checks that the
 * customer id belongs to the session tenant.
 */
export async function attachCustomerAction(input: {
  trackId: string;
  customerId: string;
}): Promise<AssignCustomerState> {
  const { tenant, admin } = await requireAdmin();
  const t = await getTranslations('trackDetail');

  const parsed = attachSchema.safeParse(input);
  if (!parsed.success) return { error: t('invalidCustomerOrTrack') };

  const res = await setTracksCustomer({
    tenantId: tenant.id,
    trackIds: [parsed.data.trackId],
    customerId: parsed.data.customerId,
    createdBy: admin.id,
  });
  if (res === 'NO_CUSTOMER') {
    return { error: (await getTranslations('tracks'))('customerNotFound') };
  }

  revalidatePath(`/tracks/${parsed.data.trackId}`);
  revalidatePath('/tracks');
  return { ok: true };
}

/** Detach this track from its customer (SPEC §5.3). Tenant-scoped. */
export async function detachCustomerAction(
  trackId: string,
): Promise<AssignCustomerState> {
  const { tenant, admin } = await requireAdmin();

  const parsed = z.string().uuid().safeParse(trackId);
  if (!parsed.success) {
    return { error: (await getTranslations('common'))('errorGeneric') };
  }

  const res = await setTracksCustomer({
    tenantId: tenant.id,
    trackIds: [parsed.data],
    customerId: null,
    createdBy: admin.id,
  });
  if (res === 'NO_CUSTOMER') {
    return { error: (await getTranslations('tracks'))('customerNotFound') };
  }

  revalidatePath(`/tracks/${parsed.data}`);
  revalidatePath('/tracks');
  return { ok: true };
}

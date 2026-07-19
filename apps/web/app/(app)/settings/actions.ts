'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { parseSomToTiyin, parseUsdToCents } from '@kargotrack/shared';
import type { TenantSettings } from '@kargotrack/db/schema';

import { requireAdmin } from '@/lib/auth';
import {
  createTariff,
  deleteTariff,
  setDefaultTariff,
  setTariffActive,
  updateTariff,
  updateTenantCurrency,
  updateTenantSettings,
} from '@/lib/queries';
import { setWebhook, webhookBaseUrl } from '@/lib/telegram';

export interface SettingsState {
  ok?: boolean;
  error?: string;
}

const schema = z.object({
  pickupAddress: z.string().max(500).optional(),
  workingHours: z.string().max(100).optional(),
  contactPhone: z.string().max(50).optional(),
  staffIds: z.string().max(2000).optional(),
  weeklyEnabled: z.string().optional(), // 'on' when the switch is on
  weekday: z.coerce.number().int().min(1).max(7),
  hour: z.coerce.number().int().min(0).max(23),
});

const trimOrNull = (s?: string) => {
  const v = s?.trim();
  return v ? v : null;
};

/** Save tenant office info + settings jsonb (SPEC §5.7). */
export async function updateSettingsAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const { tenant } = await requireAdmin();

  const parsed = schema.safeParse({
    pickupAddress: formData.get('pickupAddress') ?? undefined,
    workingHours: formData.get('workingHours') ?? undefined,
    contactPhone: formData.get('contactPhone') ?? undefined,
    staffIds: formData.get('staffIds') ?? undefined,
    weeklyEnabled: formData.get('weeklyEnabled') ?? undefined,
    weekday: formData.get('weekday'),
    hour: formData.get('hour'),
  });
  if (!parsed.success) return { error: 'Maydonlarni tekshiring.' };

  const staffTgIds = Array.from(
    new Set(
      (parsed.data.staffIds ?? '')
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => Number(s))
        .filter((n) => Number.isSafeInteger(n) && n > 0),
    ),
  );

  const settings: TenantSettings = {
    staff_tg_ids: staffTgIds,
    reminders: {
      weekly_enabled: parsed.data.weeklyEnabled === 'on',
      weekday: parsed.data.weekday,
      hour: parsed.data.hour,
    },
  };

  await updateTenantSettings({
    tenantId: tenant.id,
    pickupAddress: trimOrNull(parsed.data.pickupAddress),
    workingHours: trimOrNull(parsed.data.workingHours),
    contactPhone: trimOrNull(parsed.data.contactPhone),
    settings,
  });

  revalidatePath('/settings');
  return { ok: true };
}

// --- Currency (SPEC §5.9 Valyuta) -------------------------------------------

export interface CurrencyState {
  ok?: boolean;
  error?: string;
}

/** Save the tenant's currency + (USD) rate. Rate entered in whole so'm. */
export async function updateCurrencyAction(input: {
  currency: 'UZS' | 'USD';
  rate?: string;
}): Promise<CurrencyState> {
  const { tenant } = await requireAdmin();

  if (input.currency !== 'UZS' && input.currency !== 'USD') {
    return { error: 'Valyutani tanlang.' };
  }

  let usdRateTiyin: number | null = null;
  if (input.currency === 'USD') {
    usdRateTiyin = parseSomToTiyin(input.rate ?? '');
    if (usdRateTiyin == null) {
      return { error: "Kursni so'mda, butun musbat son kiriting." };
    }
  }

  await updateTenantCurrency({ tenantId: tenant.id, currency: input.currency, usdRateTiyin });
  revalidatePath('/settings');
  return { ok: true };
}

// --- Tariffs (SPEC §5.9 Tariflar) -------------------------------------------

export interface TariffActionState {
  ok?: boolean;
  error?: string;
}

/** Parse a per-kg price into minor units for the tenant's currency. */
function parseTariffMinor(currency: 'UZS' | 'USD', price: string): number | null {
  return currency === 'USD' ? parseUsdToCents(price) : parseSomToTiyin(price);
}

export async function createTariffAction(input: {
  name: string;
  price: string;
  isDefault: boolean;
}): Promise<TariffActionState> {
  const { tenant } = await requireAdmin();
  const name = input.name.trim();
  if (!name) return { error: 'Tarif nomini kiriting.' };

  const minor = parseTariffMinor(tenant.currency, input.price);
  if (minor == null) return { error: 'Narxni to‘g‘ri kiriting.' };

  await createTariff({
    tenantId: tenant.id,
    name,
    pricePerKgMinor: minor,
    isDefault: input.isDefault,
    active: true,
  });
  revalidatePath('/settings');
  return { ok: true };
}

export async function updateTariffAction(input: {
  tariffId: string;
  name: string;
  price: string;
}): Promise<TariffActionState> {
  const { tenant } = await requireAdmin();
  const id = z.string().uuid().safeParse(input.tariffId);
  if (!id.success) return { error: 'Xatolik yuz berdi.' };

  const name = input.name.trim();
  if (!name) return { error: 'Tarif nomini kiriting.' };
  const minor = parseTariffMinor(tenant.currency, input.price);
  if (minor == null) return { error: 'Narxni to‘g‘ri kiriting.' };

  await updateTariff({
    tenantId: tenant.id,
    tariffId: id.data,
    name,
    pricePerKgMinor: minor,
  });
  revalidatePath('/settings');
  return { ok: true };
}

export async function setDefaultTariffAction(
  tariffId: string,
): Promise<TariffActionState> {
  const { tenant } = await requireAdmin();
  const id = z.string().uuid().safeParse(tariffId);
  if (!id.success) return { error: 'Xatolik yuz berdi.' };

  const ok = await setDefaultTariff(tenant.id, id.data);
  if (!ok) return { error: 'Tarif topilmadi.' };
  revalidatePath('/settings');
  return { ok: true };
}

export async function setTariffActiveAction(
  tariffId: string,
  active: boolean,
): Promise<TariffActionState> {
  const { tenant } = await requireAdmin();
  const id = z.string().uuid().safeParse(tariffId);
  if (!id.success) return { error: 'Xatolik yuz berdi.' };

  const err = await setTariffActive(tenant.id, id.data, active);
  if (err === 'DEFAULT_MUST_STAY_ACTIVE') {
    return { error: 'Asosiy tarifni o‘chirib bo‘lmaydi. Avval boshqasini asosiy qiling.' };
  }
  if (err) return { error: 'Tarif topilmadi.' };
  revalidatePath('/settings');
  return { ok: true };
}

export async function deleteTariffAction(
  tariffId: string,
): Promise<TariffActionState> {
  const { tenant } = await requireAdmin();
  const id = z.string().uuid().safeParse(tariffId);
  if (!id.success) return { error: 'Xatolik yuz berdi.' };

  const err = await deleteTariff(tenant.id, id.data);
  if (err === 'CANNOT_DELETE_DEFAULT') {
    return { error: 'Asosiy tarifni o‘chirib bo‘lmaydi. Avval boshqasini asosiy qiling.' };
  }
  if (err) return { error: 'Tarif topilmadi.' };
  revalidatePath('/settings');
  return { ok: true };
}

export interface WebhookState {
  ok?: boolean;
  error?: string;
}

/** Re-point the tenant's bot webhook at this platform (SPEC §5.7 / §6). */
export async function reconnectWebhookAction(): Promise<WebhookState> {
  const { tenant } = await requireAdmin();

  let base: string;
  try {
    base = webhookBaseUrl();
  } catch {
    return { error: 'WEBHOOK_BASE_URL sozlanmagan.' };
  }

  const res = await setWebhook(tenant.botToken, base);
  if (!res.ok) return { error: res.error };

  revalidatePath('/settings');
  return { ok: true };
}

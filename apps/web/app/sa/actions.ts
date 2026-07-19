'use server';

import { hash } from '@node-rs/argon2';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { parseSomToTiyin, parseUsdToCents } from '@kargotrack/shared';

import {
  createTenantWithOwner,
  getTenantToken,
  tenantTokenExists,
} from '@/lib/sa-queries';
import { requireSuperadmin } from '@/lib/superadmin';
import { getMe, setWebhook, webhookBaseUrl } from '@/lib/telegram';

// --- Onboard a new tenant (SPEC §6 create form) ----------------------------

export interface OnboardState {
  error?: string;
  ok?: { name: string; botUsername: string | null };
}

const onboardSchema = z.object({
  name: z.string().trim().min(2, 'nomi').max(120),
  // BotFather tokens look like `123456789:AA...` (35-char secret).
  botToken: z
    .string()
    .trim()
    .regex(/^\d{5,}:[A-Za-z0-9_-]{30,}$/, 'token'),
  codePrefix: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2,4}$/, 'prefix'),
  currency: z.enum(['UZS', 'USD']).default('UZS'),
  usdRate: z.string().trim().optional(),
  pricePerKg: z.string().trim().min(1, 'narx'),
  pickupAddress: z.string().trim().max(300).optional(),
  workingHours: z.string().trim().max(120).optional(),
  contactPhone: z.string().trim().max(30).optional(),
  adminPhone: z.string().trim().min(4, 'telefon').max(30),
  adminPassword: z.string().min(6, 'parol').max(100),
});

/** Map a Zod field tag to an Uzbek message. */
const FIELD_ERRORS: Record<string, string> = {
  nomi: "Kompaniya nomini kiriting (kamida 2 ta belgi).",
  token: "Bot token formati noto'g'ri (masalan 123456789:AA...).",
  prefix: "Kod prefiksi 2–4 ta lotin harf bo'lishi kerak (masalan DK).",
  narx: "Kg narxini kiriting.",
  telefon: "Admin telefon raqamini kiriting.",
  parol: "Parol kamida 6 ta belgidan iborat bo'lsin.",
};

function optional(value: string | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

/**
 * SPEC §6 create flow: validate the form → `getMe` (token check) → `setWebhook`
 * → create tenant + owner admin. Any earlier failure aborts before touching the
 * database, so a bad token never leaves a half-created tenant.
 */
export async function onboardTenantAction(
  _prev: OnboardState,
  formData: FormData,
): Promise<OnboardState> {
  requireSuperadmin();

  const parsed = onboardSchema.safeParse({
    name: formData.get('name'),
    botToken: formData.get('botToken'),
    codePrefix: formData.get('codePrefix'),
    currency: formData.get('currency') ?? 'UZS',
    usdRate: formData.get('usdRate') ?? undefined,
    pricePerKg: formData.get('pricePerKg'),
    pickupAddress: formData.get('pickupAddress') ?? undefined,
    workingHours: formData.get('workingHours') ?? undefined,
    contactPhone: formData.get('contactPhone') ?? undefined,
    adminPhone: formData.get('adminPhone'),
    adminPassword: formData.get('adminPassword'),
  });
  if (!parsed.success) {
    const tag = parsed.error.issues[0]?.message ?? '';
    return { error: FIELD_ERRORS[tag] ?? "Maydonlarni to'g'ri to'ldiring." };
  }
  const input = parsed.data;

  // Default tariff price: cents for USD, tiyin for UZS. USD needs a kurs.
  const isUsd = input.currency === 'USD';
  const defaultTariffMinor = isUsd
    ? parseUsdToCents(input.pricePerKg)
    : parseSomToTiyin(input.pricePerKg);
  if (defaultTariffMinor == null) {
    return {
      error: isUsd
        ? 'Kg narxini dollarda kiriting (masalan 3.5).'
        : "Kg narxini so'mda, butun musbat son kiriting.",
    };
  }
  let usdRateTiyin: number | null = null;
  if (isUsd) {
    usdRateTiyin = parseSomToTiyin(input.usdRate ?? '');
    if (usdRateTiyin == null) {
      return { error: "USD uchun kursni so'mda, butun musbat son kiriting." };
    }
  }

  const botToken = input.botToken;

  // Must know where Telegram should POST updates before we set a webhook.
  let base: string;
  try {
    base = webhookBaseUrl();
  } catch {
    return {
      error:
        "Server sozlanmagan: WEBHOOK_BASE_URL yo'q (bot serverning ommaviy manzili).",
    };
  }

  if (await tenantTokenExists(botToken)) {
    return { error: 'Bu bot token allaqachon ro‘yxatga olingan.' };
  }

  // 1) Validate the token and learn the bot's @username.
  const me = await getMe(botToken);
  if (!me.ok) {
    return { error: `Bot token yaroqsiz: ${me.error}` };
  }
  const botUsername = me.data.username ?? null;

  // 2) Point the webhook at this platform.
  const hook = await setWebhook(botToken, base);
  if (!hook.ok) {
    return { error: `Webhook o‘rnatilmadi: ${hook.error}` };
  }

  // 3) Persist tenant + first owner admin.
  const adminPasswordHash = await hash(input.adminPassword);
  try {
    await createTenantWithOwner({
      name: input.name,
      codePrefix: input.codePrefix.toUpperCase(),
      botToken,
      botUsername,
      currency: input.currency,
      usdRateTiyin,
      defaultTariffMinor,
      pickupAddress: optional(input.pickupAddress),
      workingHours: optional(input.workingHours),
      contactPhone: optional(input.contactPhone),
      adminPhone: input.adminPhone,
      adminPasswordHash,
    });
  } catch {
    // Unique index race (token registered between our check and insert).
    return { error: 'Bu bot token allaqachon ro‘yxatga olingan.' };
  }

  revalidatePath('/sa');
  return { ok: { name: input.name, botUsername } };
}

// --- Re-set an existing tenant's webhook (SPEC §6 row action) ---------------

export interface WebhookState {
  ok?: boolean;
  error?: string;
}

export async function resetWebhookAction(
  _prev: WebhookState,
  formData: FormData,
): Promise<WebhookState> {
  requireSuperadmin();

  const tenantId = String(formData.get('tenantId') ?? '');
  if (!tenantId) return { error: 'Tenant topilmadi.' };

  const tenant = await getTenantToken(tenantId);
  if (!tenant) return { error: 'Tenant topilmadi.' };

  let base: string;
  try {
    base = webhookBaseUrl();
  } catch {
    return { error: 'WEBHOOK_BASE_URL sozlanmagan.' };
  }

  const hook = await setWebhook(tenant.botToken, base);
  if (!hook.ok) return { error: hook.error };
  return { ok: true };
}

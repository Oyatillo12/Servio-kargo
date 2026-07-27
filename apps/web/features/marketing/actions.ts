'use server';

/**
 * Public demo-request action for the landing page. This is the one Server
 * Action reachable without a session — no requireAdmin here, ever. Abuse is
 * contained by a honeypot field, a minimum fill time and a per-IP throttle.
 */

import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';

import { insertLead, notifyLeadTelegram } from '@/lib/leads';

import { leadSchema, MIN_FILL_TIME_MS } from './schema';
import { allowLead } from './throttle';

export interface LeadState {
  status: 'idle' | 'success' | 'error';
  message?: string;
}

/** First hop of x-forwarded-for — set by Caddy in front of the container. */
function clientIp(): string {
  const forwarded = headers().get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}

export async function submitLeadAction(
  _prev: LeadState,
  formData: FormData,
): Promise<LeadState> {
  const raw = {
    name: formData.get('name'),
    phone: formData.get('phone'),
    company: formData.get('company') ?? '',
    locale: formData.get('locale'),
    website: formData.get('website') ?? '',
    startedAt: formData.get('startedAt'),
  };

  // The locale drives which language the visitor gets errors in; recover it
  // even when the rest of the payload is invalid.
  const locale = raw.locale === 'ru' ? 'ru' : 'uz';
  const t = await getTranslations({ locale, namespace: 'landing' });

  const parsed = leadSchema.safeParse(raw);
  if (!parsed.success) {
    const bad = parsed.error.issues[0]?.path[0];
    // A filled honeypot is a bot — pretend it worked, record nothing.
    if (bad === 'website') return { status: 'success' };
    if (bad === 'name') return { status: 'error', message: t('formErrorName') };
    if (bad === 'phone') {
      return { status: 'error', message: t('formErrorPhone') };
    }
    return { status: 'error', message: t('formError') };
  }

  // Sub-3s submits are bots; same silent fake success as the honeypot.
  if (Date.now() - parsed.data.startedAt < MIN_FILL_TIME_MS) {
    return { status: 'success' };
  }

  if (!allowLead(clientIp())) {
    return { status: 'error', message: t('formErrorThrottle') };
  }

  try {
    await insertLead({
      name: parsed.data.name,
      phone: parsed.data.phone,
      company: parsed.data.company,
      locale: parsed.data.locale,
    });
  } catch {
    return { status: 'error', message: t('formError') };
  }

  // After the insert the lead is safe; the Telegram ping never throws.
  await notifyLeadTelegram(parsed.data);

  return { status: 'success', message: t('formSuccess') };
}

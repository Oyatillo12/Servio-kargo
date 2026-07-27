'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import { adminUsers } from '@kargotrack/db/schema';

import { requireAdmin } from '@/lib/auth';
import { isLocale, setLocaleCookie, type Locale } from '@/lib/locale';

export interface LocaleState {
  ok?: boolean;
  error?: string;
}

/**
 * Switch the panel language for the signed-in admin (AUDIT.md T17).
 *
 * Writes both copies: the cookie (what every render reads) and
 * `admin_users.lang` (what a fresh browser or a re-login restores from). The
 * layout is revalidated because every server-rendered string on screen changes.
 *
 * Deliberately its own module rather than part of `features/settings/actions.ts`
 * — the switcher lives in the global account menu, and importing that file
 * would drag every tariff/currency/webhook action into the shell's chunk.
 */
export async function setPanelLocaleAction(locale: Locale): Promise<LocaleState> {
  const { admin } = await requireAdmin();

  if (!isLocale(locale)) return { error: 'INVALID_LOCALE' };

  await getDb()
    .update(adminUsers)
    .set({ lang: locale })
    .where(eq(adminUsers.id, admin.id));

  setLocaleCookie(locale);
  revalidatePath('/', 'layout');
  return { ok: true };
}

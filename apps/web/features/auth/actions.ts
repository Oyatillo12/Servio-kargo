'use server';

import { verify } from '@node-rs/argon2';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { getTranslations } from 'next-intl/server';

import { getDb } from '@kargotrack/db';
import { adminUsers, type AdminUser } from '@kargotrack/db/schema';

import { setLocaleCookie } from '@/lib/locale';
import { COOKIE_NAME, MAX_AGE_SECONDS, createSessionToken } from '@/lib/session';

const schema = z.object({
  phone: z.string().trim().min(1),
  password: z.string().min(1),
});

export interface LoginState {
  error?: string;
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const t = await getTranslations('auth');
  /** SPEC §5.1: a single generic error for any bad phone/password. */
  const loginError = t('invalidCredentials');

  const parsed = schema.safeParse({
    phone: formData.get('phone'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { error: loginError };
  const { phone, password } = parsed.data;

  const db = getDb();
  // Phone is not globally unique across tenants, so verify against each match.
  const candidates = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.phone, phone));

  let matched: AdminUser | null = null;
  for (const admin of candidates) {
    try {
      if (await verify(admin.passwordHash, password)) {
        matched = admin;
        break;
      }
    } catch {
      // Corrupt hash — treat as a non-match, keep checking others.
    }
  }
  if (!matched) return { error: loginError };

  cookies().set(COOKIE_NAME, createSessionToken(matched.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });

  // Re-seed the UI language from the durable copy, so an admin who saved
  // Russian gets Russian on a brand-new phone or after clearing cookies.
  setLocaleCookie(matched.lang);

  redirect('/dashboard');
}

export async function logoutAction(): Promise<void> {
  cookies().delete(COOKIE_NAME);
  redirect('/login');
}

'use server';

import { verify } from '@node-rs/argon2';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { getDb } from '@kargotrack/db';
import { adminUsers } from '@kargotrack/db/schema';

import { COOKIE_NAME, MAX_AGE_SECONDS, createSessionToken } from '@/lib/session';

/** SPEC §5.1: a single generic error for any bad phone/password. */
const LOGIN_ERROR = "Telefon yoki parol noto'g'ri";

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
  const parsed = schema.safeParse({
    phone: formData.get('phone'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { error: LOGIN_ERROR };
  const { phone, password } = parsed.data;

  const db = getDb();
  // Phone is not globally unique across tenants, so verify against each match.
  const candidates = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.phone, phone));

  let matchedId: string | null = null;
  for (const admin of candidates) {
    try {
      if (await verify(admin.passwordHash, password)) {
        matchedId = admin.id;
        break;
      }
    } catch {
      // Corrupt hash — treat as a non-match, keep checking others.
    }
  }
  if (!matchedId) return { error: LOGIN_ERROR };

  cookies().set(COOKIE_NAME, createSessionToken(matchedId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });

  redirect('/dashboard');
}

export async function logoutAction(): Promise<void> {
  cookies().delete(COOKIE_NAME);
  redirect('/login');
}

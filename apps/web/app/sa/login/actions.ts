'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import {
  SA_COOKIE,
  SA_MAX_AGE_SECONDS,
  sessionMarker,
  tokenMatches,
} from '@/lib/superadmin';

const SA_LOGIN_ERROR = "Token noto'g'ri";

const schema = z.object({ token: z.string().min(1) });

export interface SaLoginState {
  error?: string;
}

/** Exchange the SUPERADMIN_TOKEN for a session cookie (SPEC §6 token gate). */
export async function saLoginAction(
  _prev: SaLoginState,
  formData: FormData,
): Promise<SaLoginState> {
  const parsed = schema.safeParse({ token: formData.get('token') });
  if (!parsed.success || !tokenMatches(parsed.data.token)) {
    return { error: SA_LOGIN_ERROR };
  }

  cookies().set(SA_COOKIE, sessionMarker(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SA_MAX_AGE_SECONDS,
  });

  redirect('/sa');
}

export async function saLogoutAction(): Promise<void> {
  cookies().delete(SA_COOKIE);
  redirect('/sa/login');
}

'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { isThrottled, SA_LOGIN_THROTTLE, throttleKey } from '@kargotrack/shared';

import { clientIp } from '@/lib/client-ip';
import { bumpThrottle } from '@/lib/queries';
import {
  SA_COOKIE,
  SA_MAX_AGE_SECONDS,
  sessionMarker,
  tokenMatches,
} from '@/lib/superadmin';

const SA_LOGIN_ERROR = "Token noto'g'ri";
// The /sa surface is platform-owner-only and deliberately uz-only, like the
// rest of its strings.
const SA_THROTTLED_ERROR =
  "Urinishlar juda ko'p. 15 daqiqadan keyin qayta urinib ko'ring.";

const schema = z.object({ token: z.string().min(1) });

export interface SaLoginState {
  error?: string;
}

/** Exchange the SUPERADMIN_TOKEN for a session cookie (SPEC §6 token gate). */
export async function saLoginAction(
  _prev: SaLoginState,
  formData: FormData,
): Promise<SaLoginState> {
  // Bump before comparing: a wrong token must cost a slot (AUDIT.md T9).
  const count = await bumpThrottle(
    throttleKey('sa', clientIp()),
    SA_LOGIN_THROTTLE.windowSeconds,
  );
  if (isThrottled(count, SA_LOGIN_THROTTLE)) {
    return { error: SA_THROTTLED_ERROR };
  }

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

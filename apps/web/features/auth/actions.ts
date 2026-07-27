'use server';

import { hash, verify } from '@node-rs/argon2';
import { eq, or } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { getTranslations } from 'next-intl/server';

import { getDb } from '@kargotrack/db';
import { adminUsers, type AdminUser } from '@kargotrack/db/schema';
import {
  canSignIn,
  checkInvite,
  isValidPassword,
  normalizeInviteCode,
} from '@kargotrack/shared';

import { canonicalAdminPhone } from '@/lib/admin-phone';
import { setLocaleCookie } from '@/lib/locale';
import { acceptInvite, findInviteByCodeAndPhone } from '@/lib/queries';
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
  //
  // Matched two ways: the string exactly as typed, and its canonical
  // `+998XXXXXXXXX` form. Rows created before invites existed hold whatever the
  // platform owner typed at onboarding, so exact match has to keep working;
  // everything issued since is canonical, and nobody types a number the same way
  // twice. Both are equality tests, so both use `admin_users_phone_idx`.
  const canonical = canonicalAdminPhone(phone);
  const candidates = await db
    .select()
    .from(adminUsers)
    .where(
      canonical && canonical !== phone
        ? or(eq(adminUsers.phone, phone), eq(adminUsers.phone, canonical))
        : eq(adminUsers.phone, phone),
    );

  let matched: AdminUser | null = null;
  for (const admin of candidates) {
    // Deactivated employees and bot-only staff (no password yet) are skipped
    // before argon2 runs — same generic error, no signal that the row exists.
    if (!canSignIn(admin) || admin.passwordHash == null) continue;
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

  await db
    .update(adminUsers)
    .set({ lastLoginAt: new Date() })
    .where(eq(adminUsers.id, matched.id));

  cookies().set(COOKIE_NAME, createSessionToken(matched.id, matched.sessionEpoch), {
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

const inviteSchema = z.object({
  phone: z.string().trim().min(1),
  code: z.string().trim().min(1),
  password: z.string().min(1),
});

/**
 * Redeem an invitation: the new employee sets their own password (SPEC §5.12).
 *
 * Lives here rather than in the team feature because it runs on /login, with no
 * session — the person has no account to authenticate as yet. Errors name the
 * actual problem ("expired", "already used") instead of the deliberately vague
 * login error: there is nothing to enumerate, the code IS the secret, and a
 * warehouse hand staring at "wrong details" has no way to guess which detail.
 */
export async function acceptInviteAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const t = await getTranslations('team');

  const parsed = inviteSchema.safeParse({
    phone: formData.get('phone'),
    code: formData.get('code'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { error: t('inviteInvalid') };

  const code = normalizeInviteCode(parsed.data.code);
  const phone = canonicalAdminPhone(parsed.data.phone);
  if (!code || !phone) return { error: t('inviteInvalid') };

  if (!isValidPassword(parsed.data.password)) {
    return { error: t('passwordTooShort') };
  }

  const invite = await findInviteByCodeAndPhone(code, phone);
  if (!invite) return { error: t('inviteInvalid') };

  const rejection = checkInvite(invite);
  if (rejection === 'expired') return { error: t('inviteExpired') };
  if (rejection === 'used') return { error: t('inviteUsed') };

  const epoch = await acceptInvite({
    inviteId: invite.inviteId,
    adminUserId: invite.adminUserId,
    passwordHash: await hash(parsed.data.password),
  });
  // Lost the race against another redemption of the same code.
  if (epoch == null) return { error: t('inviteUsed') };

  // Sign them straight in, with the epoch the redemption just produced — a
  // hardcoded 0 would be rejected on the next request for anyone whose sessions
  // had ever been revoked. A password they typed twice is not worth asking for
  // a third time, and the panel is what they were invited to.
  cookies().set(COOKIE_NAME, createSessionToken(invite.adminUserId, epoch), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
  setLocaleCookie(invite.lang);

  redirect('/dashboard');
}

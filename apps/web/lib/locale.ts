/**
 * Admin-panel locale resolution (AUDIT.md T17).
 *
 * The panel runs next-intl *without* i18n routing: URLs stay `/tracks`,
 * `/customers/:id` and the locale is carried by the `NEXT_LOCALE` cookie. The
 * cookie is the request-time source of truth (reading it costs nothing, while a
 * DB lookup would run on every render); `admin_users.lang` is the durable copy
 * that survives a new browser or phone, and login re-seeds the cookie from it.
 *
 * Note this is the ADMIN's language, deliberately separate from
 * `customers.lang` — Tashkent office staff often work in Russian while their
 * customers read Uzbek.
 */

import 'server-only';

import { cookies } from 'next/headers';

import type { Lang } from '@kargotrack/shared';

/** Locales the panel ships. Uzbek (Latin) is default, Russian secondary. */
export const LOCALES = ['uz', 'ru'] as const;

export type Locale = Lang;

export const DEFAULT_LOCALE: Locale = 'uz';

/** Cookie name next-intl uses by convention; we read/write it ourselves. */
export const LOCALE_COOKIE = 'NEXT_LOCALE';

/** One year — the admin picks a language once and it stays picked. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is Locale {
  return value === 'uz' || value === 'ru';
}

/** Coerce anything (cookie value, form field, DB column) to a valid locale. */
export function toLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * The locale for the current request. Read by `i18n/request.ts` on every
 * render, so it must stay a pure cookie read — no database, no network.
 */
export function getLocaleFromCookie(): Locale {
  return toLocale(cookies().get(LOCALE_COOKIE)?.value);
}

/**
 * Persist the locale in the cookie. Call from a Server Action or Route Handler
 * only (Next forbids cookie writes during render).
 */
export function setLocaleCookie(locale: Locale): void {
  cookies().set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: COOKIE_MAX_AGE,
    sameSite: 'lax',
    httpOnly: false,
  });
}

/**
 * next-intl request configuration (loaded by the plugin in `next.config.mjs`).
 *
 * Locale comes from the `NEXT_LOCALE` cookie — see `lib/locale.ts` for why the
 * panel resolves it there and not from the URL or the database.
 */

import { getRequestConfig } from 'next-intl/server';

import { getLocaleFromCookie, isLocale } from '@/lib/locale';

/** Every timestamp in the product is Tashkent local time (SPEC §7.9). */
export const APP_TIME_ZONE = 'Asia/Tashkent';

export default getRequestConfig(async (params) => {
  // An explicit locale (`getTranslations({locale})`) comes from the public
  // marketing pages, which are statically rendered — the cookie read below
  // would force them dynamic, so it must stay behind this branch. The panel
  // never passes a locale and keeps its cookie-based resolution.
  const locale = isLocale(params.locale)
    ? params.locale
    : getLocaleFromCookie();

  return {
    locale,
    timeZone: APP_TIME_ZONE,
    messages: (await import(`../messages/${locale}.json`)).default,
    // A missing key is a bug — next-intl's default `onError` still reports it —
    // but it must never blank out a screen. Fall back to the key path so the
    // surrounding UI stays usable and the gap is obvious.
    getMessageFallback({ key, namespace }) {
      return namespace ? `${namespace}.${key}` : key;
    },
  };
});

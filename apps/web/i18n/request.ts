/**
 * next-intl request configuration (loaded by the plugin in `next.config.mjs`).
 *
 * Locale comes from the `NEXT_LOCALE` cookie — see `lib/locale.ts` for why the
 * panel resolves it there and not from the URL or the database.
 */

import { getRequestConfig } from 'next-intl/server';

import { getLocaleFromCookie } from '@/lib/locale';

/** Every timestamp in the product is Tashkent local time (SPEC §7.9). */
export const APP_TIME_ZONE = 'Asia/Tashkent';

export default getRequestConfig(async () => {
  const locale = getLocaleFromCookie();

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

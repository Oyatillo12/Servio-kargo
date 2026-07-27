/**
 * Contact points shown on the public landing page.
 *
 * Plain code constants on purpose: the landing pages are statically rendered,
 * so env vars would be baked at build time anyway — this file is the single
 * honest place to edit them.
 *
 * TODO(owner): replace the placeholders with the real Telegram username and
 * phone before launch.
 */

/** Telegram deep link for the "write to us" CTA. */
export const TELEGRAM_URL = 'https://t.me/Oyatilloi2';

/**
 * Publicly shown contact phone in international format, or null to hide the
 * phone everywhere on the landing until there is a real number.
 */
export const CONTACT_PHONE: string | null = "+998 99 556 24 16";

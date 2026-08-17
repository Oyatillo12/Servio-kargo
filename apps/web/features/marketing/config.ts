/**
 * Everything about the public landing page that an owner edits without
 * touching a component: contacts, the demo video, the price.
 *
 * Plain code constants on purpose — the landing pages are statically
 * rendered, so env vars would be baked at build time anyway, and this file is
 * the single honest place to change them.
 */

/** Telegram deep link for the "write to us" CTA. */
export const TELEGRAM_URL = 'https://t.me/Oyatilloi2';

/**
 * Publicly shown contact phone in international format, or null to hide the
 * phone everywhere on the landing until there is a real number.
 */
export const CONTACT_PHONE: string | null = '+998 99 556 24 16';

/** A self-hosted demo recording, played in place after a click. */
export interface DemoVideo {
  /** Path under `public/`, e.g. `/demo.mp4`. Keep it under ~15 MB. */
  src: string;
  /** Poster frame under `public/`, e.g. `/demo-poster.jpg`, 16:9. */
  poster: string;
  /** Running time as shown on the play button, e.g. `2:10`. */
  duration: string;
}

/**
 * TODO(owner): drop the recording and its poster frame into `apps/web/public/`
 * and fill this in — the hero then plays it instead of showing the
 * "book a live demo" placeholder. Nothing else on the page needs to change.
 *
 *   export const DEMO_VIDEO: DemoVideo | null = {
 *     src: '/demo.mp4',
 *     poster: '/demo-poster.jpg',
 *     duration: '2:10',
 *   };
 */
export const DEMO_VIDEO: DemoVideo | null = null;

/**
 * Monthly subscription in whole so'm per plan, or null while the number is
 * still being decided — the pricing card then says the price is agreed per
 * company instead of showing a figure. The two tiers mirror `tenants.plan`
 * (packages/shared/services/plans.ts): premium adds the Mini App cabinet.
 *
 * TODO(owner): set these once the tariffs are fixed, e.g. `500_000`.
 */
export const PRICE_BASIC_SOM: number | null = null;
export const PRICE_PREMIUM_SOM: number | null = null;

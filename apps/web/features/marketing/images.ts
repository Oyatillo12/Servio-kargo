import type { StaticImageData } from 'next/image';

import type { Lang } from '@kargotrack/shared';

import addressBotRu from '../../public/images/address-bot.jpg';
import botCalculatorRu from '../../public/images/bot-calculator.jpg';
import botChatUz from '../../public/images/bot-image.jpg';
import dashboardUz from '../../public/images/dashboard.png';
import debtorsRu from '../../public/images/debtors.png';
import importRu from '../../public/images/import.png';
import tracksUz from '../../public/images/tracks.png';

/**
 * Product screenshots used on the landing page.
 *
 * Statically imported so Next knows their intrinsic size (no layout shift) and
 * can generate a blur placeholder. Real screens of the real product — the
 * page's only evidence, so nothing here may be a mockup or a render.
 *
 * KEYED BY LOCALE, because a screenshot is UI: a Russian "Должники" header on
 * the Uzbek page reads as carelessness, which is the exact impression the page
 * is trying to shed. Where only one language has been captured, both entries
 * point at the same file — the page still renders, it is just mismatched for
 * one locale until the other capture lands.
 *
 * TO ADD A MISSING CAPTURE: switch the panel (or the bot) to that language,
 * screenshot the same screen, drop it in `public/images/`, import it above and
 * replace the placeholder on the relevant line. Nothing else changes.
 */
type LocalisedShot = Record<Lang, StaticImageData>;

export const SHOTS = {
  /** Panel home: worklists, cargo flow, debt total. */
  dashboard: { uz: dashboardUz, ru: dashboardUz },
  /** Import wizard, upload step: Excel drop zone and the paste-text box. */
  importer: { uz: importRu, ru: importRu },
  /** Track list: filters, statuses, batches, weight, price, Excel export. */
  tracks: { uz: tracksUz, ru: tracksUz },
  /** Debtors: total owed, per-customer balances, one-tap reminder. */
  debtors: { uz: debtorsRu, ru: debtorsRu },
  /** Bot: status notifications as the customer receives them. */
  botChat: { uz: botChatUz, ru: botChatUz },
  /** Bot: the price calculator — tariff, then weight, then an estimate. */
  botCalculator: { uz: botCalculatorRu, ru: botCalculatorRu },
  /** Bot: the China warehouse address with the customer's own client code. */
  botAddress: { uz: addressBotRu, ru: addressBotRu },
} satisfies Record<string, LocalisedShot>;

export type ShotKey = keyof typeof SHOTS;

/** The capture for `key` in `locale`. */
export function shotFor(key: ShotKey, locale: Lang): StaticImageData {
  return SHOTS[key][locale];
}

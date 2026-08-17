import type { StaticImageData } from 'next/image';

import type { Lang } from '@kargotrack/shared';

import addressBot from '../../public/images/address-bot.jpg';
import botCalculator from '../../public/images/bot-calculator.jpg';
import botChat from '../../public/images/bot-image.jpg';
import dashboardRu from '../../public/images/panel-dashboard-ru.png';
import dashboardUz from '../../public/images/panel-dashboard-uz.png';
import debtorsRu from '../../public/images/panel-debtors-ru.png';
import debtorsUz from '../../public/images/panel-debtors-uz.png';
import importRu from '../../public/images/panel-import-ru.png';
import importUz from '../../public/images/panel-import-uz.png';
import tracksRu from '../../public/images/panel-tracks-ru.png';
import tracksUz from '../../public/images/panel-tracks-uz.png';
import weighRu from '../../public/images/panel-weigh-ru.png';
import weighUz from '../../public/images/panel-weigh-uz.png';

/**
 * Product screenshots used on the landing page.
 *
 * Statically imported so Next knows their intrinsic size (no layout shift) and
 * can generate a blur placeholder. Real screens of the real product — the
 * page's only evidence, so nothing here may be a mockup or a render (D-013).
 *
 * KEYED BY LOCALE, because a screenshot is UI: a Russian "Должники" header on
 * the Uzbek page reads as carelessness, which is the exact impression the page
 * is trying to shed. The panel captures exist in both languages (re-shot from
 * the TERMINAL panel, 2026-08); the bot captures are real Telegram chats and
 * currently exist in one capture each — both entries point at the same file
 * until the other capture lands.
 *
 * TO RE-SHOOT: log into the demo tenant, switch the panel language, capture
 * the same screen at 1600×900 (the repo captures were taken headless at
 * deviceScaleFactor 2), drop it in `public/images/` and update the import.
 */
type LocalisedShot = Record<Lang, StaticImageData>;

export const SHOTS = {
  /** Panel home: worklists, cargo flow, cash by staff, debt total. */
  dashboard: { uz: dashboardUz, ru: dashboardRu },
  /** Import wizard, upload step: Excel drop zone and the paste-text box. */
  importer: { uz: importUz, ru: importRu },
  /** Track list filtered to "ready for pickup": weights, prices, batches. */
  tracks: { uz: tracksUz, ru: tracksRu },
  /** Debtors: total owed, per-customer balances, one-tap reminder. */
  debtors: { uz: debtorsUz, ru: debtorsRu },
  /** The warehouse weigh console: code → weight → today's list. */
  weigh: { uz: weighUz, ru: weighRu },
  /** Bot: status notifications as the customer receives them. */
  botChat: { uz: botChat, ru: botChat },
  /** Bot: the price calculator — tariff, then weight, then an estimate. */
  botCalculator: { uz: botCalculator, ru: botCalculator },
  /** Bot: the China warehouse address with the customer's own client code. */
  botAddress: { uz: addressBot, ru: addressBot },
} satisfies Record<string, LocalisedShot>;

export type ShotKey = keyof typeof SHOTS;

/** The capture for `key` in `locale`. */
export function shotFor(key: ShotKey, locale: Lang): StaticImageData {
  return SHOTS[key][locale];
}

/**
 * Keyboard builders. Reply keyboards for the main menu + phone request; inline
 * keyboards for language choice and My-tracks pagination. All labels come from
 * i18n (CLAUDE.md rule 5).
 */

import { InlineKeyboard, Keyboard } from 'grammy';

import type { Tariff } from '@kargotrack/db/schema';
import {
  LANG_BUTTON_RU,
  LANG_BUTTON_UZ,
  type Strings,
} from '@kargotrack/shared';

/** Two inline buttons: `O'zbekcha 🇺🇿` / `Русский 🇷🇺` (SPEC §3.1). */
export function langKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text(LANG_BUTTON_UZ, 'lang:uz')
    .text(LANG_BUTTON_RU, 'lang:ru');
}

/** One-time reply keyboard with a contact-request button (SPEC §3.1 / §4.1). */
export function phoneKeyboard(s: Strings): Keyboard {
  return new Keyboard().requestContact(s.askPhoneButton).resized().oneTime();
}

/** Main menu reply keyboard — 2 columns, 4 rows (SPEC §3.1). */
export function mainMenuKeyboard(s: Strings): Keyboard {
  return new Keyboard()
    .text(s.menuAddTrack)
    .text(s.menuMyTracks)
    .row()
    .text(s.menuCalculator)
    .text(s.menuBalance)
    .row()
    .text(s.menuChinaAddress)
    .text(s.menuInfo)
    .row()
    .text(s.menuLang)
    .resized();
}

/** Inline keyboard of active tariffs for the calculator (SPEC §3.9). */
export function calcTariffsKeyboard(tariffs: Tariff[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const tf of tariffs) kb.text(tf.name, `calc:${tf.id}`).row();
  return kb;
}

/**
 * Pagination controls for My tracks. Shows ◀️ / ▶️ only when there is a
 * previous / next page. Returns `undefined` when there is a single page.
 */
export function paginationKeyboard(
  page: number,
  pages: number,
): InlineKeyboard | undefined {
  if (pages <= 1) return undefined;
  const kb = new InlineKeyboard();
  if (page > 1) kb.text('◀️', `mytracks:${page - 1}`);
  if (page < pages) kb.text('▶️', `mytracks:${page + 1}`);
  return kb;
}

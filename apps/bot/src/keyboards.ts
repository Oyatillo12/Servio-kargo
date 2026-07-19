/**
 * Keyboard builders. Reply keyboards for the main menu + phone request; inline
 * keyboards for language choice and My-tracks pagination. All labels come from
 * i18n (CLAUDE.md rule 5).
 */

import { InlineKeyboard, Keyboard } from 'grammy';
import type { BotCommand } from 'grammy/types';

import type { Tariff, Track } from '@kargotrack/db/schema';
import {
  LANG_BUTTON_RU,
  LANG_BUTTON_UZ,
  STATUS_META,
  type Strings,
} from '@kargotrack/shared';

/** Slash-command list for the Telegram "Menu" button (setMyCommands). */
export function botCommands(s: Strings): BotCommand[] {
  return [
    { command: 'start', description: s.commands.start },
    { command: 'mytracks', description: s.commands.mytracks },
    { command: 'balance', description: s.commands.balance },
    { command: 'calc', description: s.commands.calc },
    { command: 'info', description: s.commands.info },
    { command: 'manzil', description: s.commands.manzil },
  ];
}

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
 * My-tracks keyboard: one tappable button per track on the page (opens its full
 * status card via `track:{id}`), then a ◀️ / ▶️ pagination row when there is
 * more than one page.
 */
export function myTracksKeyboard(
  slice: Track[],
  page: number,
  pages: number,
): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const track of slice) {
    kb.text(
      `${STATUS_META[track.currentStatus].emoji} ${track.codeOriginal}`,
      `track:${track.id}`,
    ).row();
  }
  if (pages > 1) {
    if (page > 1) kb.text('◀️', `mytracks:${page - 1}`);
    if (page < pages) kb.text('▶️', `mytracks:${page + 1}`);
  }
  return kb;
}

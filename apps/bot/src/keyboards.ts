/**
 * Keyboard builders. Reply keyboards for the main menu + phone request; inline
 * keyboards for language choice, My-tracks navigation and the contextual
 * "what now?" rows attached to result messages (SPEC §3.11). All labels come
 * from i18n (CLAUDE.md rule 5).
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
    { command: 'karta', description: s.commands.karta },
    { command: 'help', description: s.commands.help },
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

/**
 * Main menu reply keyboard — 2 columns, 5 rows (SPEC §3.1). A premium
 * tenant's keyboard leads with a Mini App button (SPEC §10.1, tasks.md B7);
 * pressing it opens the cabinet directly, no text update is sent, so the
 * text router never sees it.
 */
export function mainMenuKeyboard(s: Strings, miniAppUrl?: string): Keyboard {
  const kb = new Keyboard();
  if (miniAppUrl) kb.webApp(s.menuCabinet, miniAppUrl).row();
  return kb
    .text(s.menuAddTrack)
    .text(s.menuMyTracks)
    .row()
    .text(s.menuCalculator)
    .text(s.menuBalance)
    .row()
    .text(s.menuChinaAddress)
    .text(s.menuInfo)
    .row()
    // §3.14: the card sits next to the support button because both are what a
    // customer reaches for while standing at the counter.
    .text(s.menuCard)
    .text(s.menuTicket)
    .row()
    .text(s.menuLang)
    .resized();
}

/**
 * Single "cancel" row for a message that owns a pending prompt (SPEC §3.11).
 *
 * Multi-step flows used to have no exit: once the bot was waiting for a weight,
 * anything the customer typed was read as an answer to that question, and the
 * only escape was to notice the reply keyboard below and tap another section.
 */
export function cancelKeyboard(s: Strings): InlineKeyboard {
  return new InlineKeyboard().text(s.nav.cancel, 'cancel');
}

/** Inline keyboard of active tariffs for the calculator (SPEC §3.9). */
export function calcTariffsKeyboard(
  tariffs: Tariff[],
  s: Strings,
): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const tf of tariffs) kb.text(tf.name, `calc:${tf.id}`).row();
  kb.text(s.nav.cancel, 'cancel');
  return kb;
}

/**
 * Dimensions step (§3.9, §7.16): skip is a button rather than an instruction to
 * type something, so the optional step costs one tap to leave.
 */
export function calcSkipDimsKeyboard(s: Strings): InlineKeyboard {
  return new InlineKeyboard()
    .text(s.calcSkipDims, 'calc:skipdims')
    .row()
    .text(s.nav.cancel, 'cancel');
}

/** After a calculation: run it again without re-opening the menu (§3.11). */
export function calcResultKeyboard(
  s: Strings,
  /** Premium only: the cabinet's calculator does the same sum with a form. */
  miniAppUrl?: string,
): InlineKeyboard {
  const kb = new InlineKeyboard().text(s.nav.recalc, 'calc:restart');
  if (miniAppUrl) kb.row().webApp(s.nav.openCabinet, miniAppUrl);
  return kb;
}

/**
 * My-tracks keyboard: one tappable button per track on the page (opens its full
 * status card via `track:{id}`), then a ◀️ / ▶️ pagination row when there is
 * more than one page, and a refresh so a customer waiting on a delivery can
 * re-check without retyping anything.
 */
export function myTracksKeyboard(
  slice: Track[],
  page: number,
  pages: number,
  s: Strings,
  /** Premium only: deep link to the cabinet's own track list (D-012). */
  miniAppUrl?: string,
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
    kb.row();
  }
  kb.text(s.nav.refresh, `mytracks:${page}:refresh`);
  // Paging a long list one message at a time is what the cabinet is for; the
  // chat keeps the quick look, the app takes over when there is more to see.
  if (miniAppUrl) kb.row().webApp(s.nav.openCabinet, miniAppUrl);
  return kb;
}

/**
 * Actions under a track's status card (SPEC §3.11).
 *
 * `fromPage` is set when the card replaced a My-tracks listing in place: the
 * back button restores that exact page, so opening five parcels in a row costs
 * one message instead of eleven.
 */
export function trackCardKeyboard(
  s: Strings,
  trackId: string,
  fromPage?: number,
): InlineKeyboard {
  const kb = new InlineKeyboard().text(s.nav.refresh, `track:${trackId}:refresh`);
  if (fromPage != null) kb.text(s.nav.backToList, `mytracks:${fromPage}`);
  return kb;
}

/** "Where next?" row under the add-track summary (SPEC §3.11). */
export function addSummaryKeyboard(s: Strings): InlineKeyboard {
  return new InlineKeyboard()
    .text(s.nav.addMore, 'addmore')
    .text(s.nav.myTracks, 'mytracks:1');
}

/** "Where next?" row under the balance card (SPEC §3.11). */
export function balanceKeyboard(
  s: Strings,
  /** Premium only: the full payment history lives in the cabinet (D-012). */
  miniAppUrl?: string,
): InlineKeyboard {
  const kb = new InlineKeyboard().text(s.nav.myTracks, 'mytracks:1');
  if (miniAppUrl) kb.row().webApp(s.nav.openCabinet, miniAppUrl);
  return kb;
}

/**
 * Shortcut row under the "I didn't understand that" fallback (SPEC §3.11).
 * A confused customer is exactly the one who will not go hunting through a
 * reply keyboard, so the two things they most likely wanted are one tap away.
 */
export function helpFallbackKeyboard(s: Strings): InlineKeyboard {
  return new InlineKeyboard()
    .text(s.nav.myTracks, 'mytracks:1')
    .text(s.nav.balance, 'balance')
    .row()
    .text(s.commands.help, 'help');
}

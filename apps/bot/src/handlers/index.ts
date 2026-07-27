/**
 * Wire all customer-flow handlers onto a bot instance. Registration order
 * matters: specific matchers (command, callbacks, contact) come before the
 * catch-all text router.
 *
 * Callback-data grammar (SPEC §3.11) — `action[:arg][:modifier]`:
 *   `lang:uz`            language choice
 *   `mytracks:2`         open page 2 of the listing, in place
 *   `mytracks:2:refresh` re-read page 2 and report whether anything changed
 *   `track:{id}`         open a track's card, replacing the listing
 *   `track:{id}:refresh` re-read that card
 *   `photo:{id}`         send the warehouse photo as its own message
 *   `calc:{tariffId}`    pick a tariff · `calc:restart` re-runs the calculator
 *   `addmore` `balance` `help` `cancel`
 */

import type { Bot } from 'grammy';

import type { KargoContext } from '../context';
import { addMoreCallback } from './addTrack';
import {
  calcRestartCallback,
  calcTariffCallback,
  showCalculator,
} from './calculator';
import { showChinaAddress } from './china';
import { contactHandler, langCallback, startCommand } from './start';
import {
  balanceCallback,
  helpCallback,
  myTracksPageCallback,
  showBalance,
  showHelp,
  showInfo,
  showMyTracks,
  trackDetailCallback,
  trackPhotoCallback,
} from './menu';
import { staffPhotoHandler } from './staffPhoto';
import { cancelCallback, textRouter } from './text';

export function registerHandlers(bot: Bot<KargoContext>): void {
  bot.command('start', startCommand);

  // Slash commands mirror the reply-keyboard menu (discoverable via the
  // Telegram "Menu" button; descriptions set through setMyCommands).
  bot.command('mytracks', showMyTracks);
  bot.command('balance', showBalance);
  bot.command('calc', showCalculator);
  bot.command('info', showInfo);
  bot.command('manzil', showChinaAddress);
  bot.command('help', showHelp);

  bot.callbackQuery(/^lang:(uz|ru)$/, langCallback);
  bot.callbackQuery(/^mytracks:(\d+)(?::(refresh))?$/, myTracksPageCallback);
  bot.callbackQuery(/^track:([^:]+)(?::(refresh))?$/, trackDetailCallback);
  bot.callbackQuery(/^photo:(.+)$/, trackPhotoCallback);
  // `calc:restart` must be matched before the generic tariff pattern, which
  // would otherwise capture "restart" as a tariff id.
  bot.callbackQuery(/^calc:restart$/, calcRestartCallback);
  bot.callbackQuery(/^calc:(.+)$/, calcTariffCallback);
  bot.callbackQuery(/^addmore$/, addMoreCallback);
  bot.callbackQuery(/^balance$/, balanceCallback);
  bot.callbackQuery(/^help$/, helpCallback);
  bot.callbackQuery(/^cancel$/, cancelCallback);

  bot.on('message:contact', contactHandler);
  bot.on('message:photo', staffPhotoHandler);
  bot.on('message:text', textRouter);
}

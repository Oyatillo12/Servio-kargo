/**
 * Wire all customer-flow handlers onto a bot instance. Registration order
 * matters: specific matchers (command, callbacks, contact) come before the
 * catch-all text router.
 */

import type { Bot } from 'grammy';

import type { KargoContext } from '../context';
import { showCalculator, calcTariffCallback } from './calculator';
import { showChinaAddress } from './china';
import { contactHandler, langCallback, startCommand } from './start';
import {
  myTracksPageCallback,
  showBalance,
  showInfo,
  showMyTracks,
  trackDetailCallback,
} from './menu';
import { staffPhotoHandler } from './staffPhoto';
import { textRouter } from './text';

export function registerHandlers(bot: Bot<KargoContext>): void {
  bot.command('start', startCommand);

  // Slash commands mirror the reply-keyboard menu (discoverable via the
  // Telegram "Menu" button; descriptions set through setMyCommands).
  bot.command('mytracks', showMyTracks);
  bot.command('balance', showBalance);
  bot.command('calc', showCalculator);
  bot.command('info', showInfo);
  bot.command('manzil', showChinaAddress);

  bot.callbackQuery(/^lang:(uz|ru)$/, langCallback);
  bot.callbackQuery(/^mytracks:(\d+)$/, myTracksPageCallback);
  bot.callbackQuery(/^track:(.+)$/, trackDetailCallback);
  bot.callbackQuery(/^calc:(.+)$/, calcTariffCallback);

  bot.on('message:contact', contactHandler);
  bot.on('message:photo', staffPhotoHandler);
  bot.on('message:text', textRouter);
}

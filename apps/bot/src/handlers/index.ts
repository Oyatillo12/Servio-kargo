/**
 * Wire all customer-flow handlers onto a bot instance. Registration order
 * matters: specific matchers (command, callbacks, contact) come before the
 * catch-all text router.
 */

import type { Bot } from 'grammy';

import type { KargoContext } from '../context';
import { calcTariffCallback } from './calculator';
import { contactHandler, langCallback, startCommand } from './start';
import { myTracksPageCallback } from './menu';
import { staffPhotoHandler } from './staffPhoto';
import { textRouter } from './text';

export function registerHandlers(bot: Bot<KargoContext>): void {
  bot.command('start', startCommand);

  bot.callbackQuery(/^lang:(uz|ru)$/, langCallback);
  bot.callbackQuery(/^mytracks:(\d+)$/, myTracksPageCallback);
  bot.callbackQuery(/^calc:(.+)$/, calcTariffCallback);

  bot.on('message:contact', contactHandler);
  bot.on('message:photo', staffPhotoHandler);
  bot.on('message:text', textRouter);
}

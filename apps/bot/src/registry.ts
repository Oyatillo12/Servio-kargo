/**
 * Multi-bot registry (CLAUDE.md rule 2). Resolves a bot instance from its
 * webhook path token, building + caching it on first use so tenants added after
 * startup work without a restart. `init()` is required before `handleUpdate`
 * in webhook mode (polling's `bot.start()` inits on its own).
 */

import type { Bot } from 'grammy';

import { t } from '@kargotrack/shared';

import { createBot } from './bot';
import type { KargoContext } from './context';
import { botCommands } from './keyboards';
import { getTenantByToken } from './queries';
import { logger } from './logger';

export interface BotEntry {
  bot: Bot<KargoContext>;
}

export class BotRegistry {
  private cache = new Map<string, BotEntry>();
  private pending = new Map<string, Promise<BotEntry | undefined>>();

  /**
   * Resolve (and cache) the bot for a webhook token, or `undefined` if no tenant
   * has that token or it fails to initialize.
   */
  async getByToken(token: string): Promise<BotEntry | undefined> {
    const hit = this.cache.get(token);
    if (hit) return hit;

    let inflight = this.pending.get(token);
    if (!inflight) {
      inflight = this.buildAndInit(token);
      this.pending.set(token, inflight);
      void inflight.finally(() => this.pending.delete(token));
    }
    return inflight;
  }

  private async buildAndInit(token: string): Promise<BotEntry | undefined> {
    const tenant = await getTenantByToken(token);
    if (!tenant) return undefined;
    try {
      const bot = createBot(tenant.id, token);
      await bot.init(); // fetches bot info; needed before handleUpdate
      await this.registerCommands(bot);
      const entry: BotEntry = { bot };
      this.cache.set(token, entry);
      logger.info(
        { tenant: tenant.name, bot: bot.botInfo.username },
        'registered bot',
      );
      return entry;
    } catch (err) {
      logger.error({ err, tenant: tenant.name }, 'failed to init bot');
      return undefined;
    }
  }

  /**
   * Populate the Telegram "Menu" command button. Uzbek is the default scope;
   * Russian is registered for clients whose language is `ru`. Never fatal — a
   * failed command sync must not stop the bot from serving updates.
   */
  private async registerCommands(bot: Bot<KargoContext>): Promise<void> {
    try {
      await bot.api.setMyCommands(botCommands(t('uz')));
      await bot.api.setMyCommands(botCommands(t('ru')), {
        language_code: 'ru',
      });
    } catch (err) {
      logger.warn({ err }, 'failed to set bot commands');
    }
  }
}

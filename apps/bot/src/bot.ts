/**
 * Build a per-tenant grammY bot: session → tenant/customer loading middleware →
 * handlers, all under an error boundary so one bad update never crashes the
 * process (CLAUDE.md rule 8, SPEC §8).
 */

import { Bot, GrammyError, HttpError, session } from 'grammy';

import { t } from '@kargotrack/shared';

import type { KargoContext, SessionData } from './context';
import { registerHandlers } from './handlers';
import { logger } from './logger';
import { getCustomerByTg, getTenantById } from './queries';

export function createBot(tenantId: string, token: string): Bot<KargoContext> {
  const bot = new Bot<KargoContext>(token);

  // In-memory session (transient two-step state); fine for the MVP.
  bot.use(session({ initial: (): SessionData => ({}) }));

  // Load the tenant fresh each update (so price/address changes take effect),
  // resolve the customer + effective language, and attach the string catalogue.
  bot.use(async (ctx, next) => {
    const tenant = await getTenantById(tenantId);
    if (!tenant) {
      logger.warn({ tenantId }, 'tenant not found; dropping update');
      return;
    }
    ctx.tenant = tenant;

    const tgId = ctx.from?.id;
    const customer = tgId ? await getCustomerByTg(tenant.id, tgId) : undefined;
    ctx.customer = customer;
    if (customer && !ctx.session.lang) ctx.session.lang = customer.lang;
    ctx.lang = customer?.lang ?? ctx.session.lang ?? 'uz';
    ctx.s = t(ctx.lang);

    await next();
  });

  registerHandlers(bot);

  // Error boundary. Log everything; reply only for direct user interactions.
  bot.catch(async (err) => {
    const ctx = err.ctx;
    const e = err.error;
    if (e instanceof GrammyError) {
      logger.error(
        { err: e.description, method: e.method },
        'Telegram API error',
      );
    } else if (e instanceof HttpError) {
      logger.error({ err: e.message }, 'network error talking to Telegram');
    } else {
      logger.error({ err: e, updateId: ctx.update.update_id }, 'handler error');
    }

    try {
      const s = ctx.s ?? t(ctx.session?.lang ?? 'uz');
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({ text: s.errorGeneric });
      } else if (ctx.chat) {
        await ctx.reply(s.errorGeneric);
      }
    } catch (replyErr) {
      logger.error({ err: replyErr }, 'failed to send error reply');
    }
  });

  return bot;
}

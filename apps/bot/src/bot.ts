/**
 * Build a per-tenant grammY bot: session → tenant/customer loading middleware →
 * handlers, all under an error boundary so one bad update never crashes the
 * process (CLAUDE.md rule 8, SPEC §8).
 */

import { Bot, GrammyError, HttpError, session } from 'grammy';

import { t } from '@kargotrack/shared';

import type { KargoContext, SessionData } from './context';
import { registerHandlers } from './handlers';
import { inboundLimiter } from './inboundLimiter';
import { logger } from './logger';
import { getCustomerByTg, getStaffByTg, getTenantById } from './queries';
import { captureError } from './sentry';
import { createSessionStorage } from './sessionStorage';

export function createBot(tenantId: string, token: string): Bot<KargoContext> {
  const bot = new Bot<KargoContext>(token);

  // Inbound throttle (tasks.md F2) — FIRST, before the session middleware,
  // because shedding load after the DB round-trips would defeat the point.
  // Dropped silently: a "slow down" reply would itself be outbound spam. A
  // throttled callback query is left unanswered on purpose — its button
  // spins until Telegram times out; that is the flood guard working, not a
  // bug to fix with an answerCallbackQuery (which would be outbound traffic).
  bot.use(async (ctx, next) => {
    const chatId = ctx.chat?.id ?? ctx.from?.id;
    if (chatId != null && !inboundLimiter.allow(tenantId, chatId)) {
      logger.debug({ tenantId, chatId }, 'inbound update throttled');
      return;
    }
    await next();
  });

  // Session state lives in Postgres (AUDIT.md T16) so a deploy doesn't kick
  // customers out of half-finished flows mid-conversation.
  bot.use(
    session({
      initial: (): SessionData => ({}),
      storage: createSessionStorage(tenantId),
    }),
  );

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
    // Customer and employee are resolved together: they are two different roles
    // for the same Telegram account, and an owner is often their own customer.
    // One round trip, because this runs on every single update.
    const [customer, staff] = tgId
      ? await Promise.all([
          getCustomerByTg(tenant.id, tgId),
          getStaffByTg(tenant.id, tgId),
        ])
      : [undefined, undefined];
    ctx.customer = customer;
    ctx.staff = staff;
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

    // Report every handler failure: a bug that breaks one flow for one tenant
    // is exactly the kind of thing nobody notices until a customer complains.
    // Identifiers only — no names, phones or codes (they are scrubbed anyway).
    captureError(e, {
      tenantId,
      updateId: ctx.update.update_id,
      updateType: Object.keys(ctx.update).find((k) => k !== 'update_id'),
    });

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

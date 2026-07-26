/**
 * @kargotrack/bot — multi-tenant grammY Telegram bot server.
 *
 * Default: webhook mode. Bots are resolved lazily by webhook path token
 * (`/webhook/:botToken`) via the registry. Set `BOT_POLLING=true` to long-poll
 * instead (local dev with a real BotFather token, no public URL needed) —
 * `BOT_POLLING_TOKEN` narrows polling to a single tenant.
 */

import 'dotenv/config';

import { APP_NAME } from '@kargotrack/shared';

import { createBot } from './bot';
import { getConfig } from './config';
import { logger } from './logger';
import { captureError, flushSentry, initSentry } from './sentry';
import { listTenants } from './queries';
import { BotRegistry } from './registry';
import { startServer } from './server';
import {
  startBroadcastWorker,
  startNotificationWorker,
  startReminderWorker,
} from './worker';

async function startPolling(pollingToken?: string): Promise<void> {
  const tenants = await listTenants();
  const chosen = pollingToken
    ? tenants.filter((t) => t.botToken === pollingToken)
    : tenants;

  if (chosen.length === 0) {
    logger.warn(
      { pollingToken: pollingToken ? '(set)' : '(unset)' },
      'polling mode: no matching tenants to start',
    );
    return;
  }

  for (const tenant of chosen) {
    const bot = createBot(tenant.id, tenant.botToken);
    try {
      await bot.api.deleteWebhook({ drop_pending_updates: false });
    } catch (err) {
      logger.warn(
        { err, tenant: tenant.name },
        'deleteWebhook failed (ignored)',
      );
    }
    // bot.start() resolves only when the bot stops — do not await it.
    void bot
      .start({
        onStart: (me) =>
          logger.info(`polling @${me.username} (tenant: ${tenant.name})`),
      })
      .catch((err) =>
        logger.error({ err, tenant: tenant.name }, 'polling bot crashed'),
      );
  }
}

async function main(): Promise<void> {
  // ESM imports are hoisted, so this cannot run "before the imports" — it runs
  // before any of OUR code does, which is what error reporting needs. Tracing
  // is off (see sentry.ts), so no auto-instrumentation ordering applies.
  initSentry();

  const config = getConfig();
  const registry = new BotRegistry();

  // Health (+ webhook, in webhook mode) HTTP server runs in both modes.
  startServer(config, registry);

  // Outbound notification worker (pg-boss). Failing to start must not crash the
  // bot process (CLAUDE.md rule 8) — log and keep serving updates. A worker that
  // never starts means notifications silently stop, so it is reported too.
  startNotificationWorker().catch((err) => {
    logger.error({ err }, 'failed to start notification worker');
    captureError(err, { where: 'startNotificationWorker' });
  });

  // Debt reminders (manual + weekly sweep). Same rule 8 guarantee — a failure to
  // start must not crash the bot process.
  startReminderWorker().catch((err) => {
    logger.error({ err }, 'failed to start reminder worker');
    captureError(err, { where: 'startReminderWorker' });
  });

  // Broadcasts (admin → all customers). Same rule 8 guarantee.
  startBroadcastWorker().catch((err) => {
    logger.error({ err }, 'failed to start broadcast worker');
    captureError(err, { where: 'startBroadcastWorker' });
  });

  if (config.polling) {
    logger.info(`${APP_NAME} bot starting in POLLING mode`);
    await startPolling(config.pollingToken);
  } else {
    logger.info(`${APP_NAME} bot starting in WEBHOOK mode`);
  }
}

main().catch(async (err) => {
  logger.error({ err }, 'fatal startup error');
  captureError(err, { where: 'startup' });
  // This is the one path that does exit, so give the report time to leave.
  await flushSentry();
  process.exit(1);
});

// The bot must never die — log and continue on unexpected errors (CLAUDE.md 8).
// Sentry's own handlers for these are removed in sentry.ts precisely because
// they can terminate the process; we report and keep running instead.
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'uncaughtException');
  captureError(err, { where: 'uncaughtException' });
});
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'unhandledRejection');
  captureError(reason, { where: 'unhandledRejection' });
});

/**
 * @kargotrack/bot — grammY Telegram bot server (multi-bot, webhook mode).
 *
 * Skeleton only: starts a minimal HTTP server and logs "ready". Webhook
 * routing (`/webhook/:botToken`), tenant resolution, handlers and the
 * pg-boss notification queue are added in later feature tasks per CLAUDE.md
 * and SPEC.md section 3.
 */

import { createServer } from 'node:http';

import { APP_NAME } from '@kargotrack/shared';

import { logger } from './logger';

const PORT = Number(process.env.PORT ?? 8443);

const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', app: APP_NAME }));
    return;
  }
  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  logger.info(`${APP_NAME} bot ready on :${PORT}`);
});

// Keep the process alive on unexpected errors — the bot must never die.
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'uncaughtException');
});
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'unhandledRejection');
});

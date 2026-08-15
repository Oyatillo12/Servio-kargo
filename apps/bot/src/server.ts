/**
 * HTTP server: health check + multi-tenant webhook endpoint.
 *
 * Webhooks are routed by `/webhook/t/:tenantId` and authenticated with the
 * `X-Telegram-Bot-Api-Secret-Token` header, derived per tenant from
 * SESSION_SECRET (tasks.md F3). The old `/webhook/:botToken` route — where the
 * bot token itself was the URL, and therefore sat in every proxy access log —
 * is kept only for the switchover window until every tenant's webhook has been
 * re-set (the /sa "Webhook" button / onboarding do that), and logs a warning
 * on every hit so lingering old registrations are visible.
 */

import { createServer, type IncomingMessage, type Server } from 'node:http';

import { APP_NAME } from '@kargotrack/shared';
import {
  webhookSecretFor,
  webhookSecretMatches,
} from '@kargotrack/shared/webhook';

import type { BotConfig } from './config';
import { logger } from './logger';
import type { BotEntry, BotRegistry } from './registry';

const WEBHOOK_TENANT_RE = /^\/webhook\/t\/([0-9a-f-]{36})$/;
const WEBHOOK_LEGACY_RE = /^\/webhook\/(.+)$/;
const MAX_BODY_BYTES = 1_000_000; // Telegram updates are small; cap to be safe.

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

export function startServer(config: BotConfig, registry: BotRegistry): Server {
  const server = createServer((req, res) => {
    handle(req, res, registry, config).catch((err) => {
      logger.error({ err }, 'unhandled server error');
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'text/plain' });
        res.end('Internal Server Error');
      }
    });
  });

  server.listen(config.port, () => {
    logger.info(`${APP_NAME} bot HTTP server on :${config.port}`);
  });
  return server;
}

async function handle(
  req: IncomingMessage,
  res: import('node:http').ServerResponse,
  registry: BotRegistry,
  config: BotConfig,
): Promise<void> {
  const path = (req.url ?? '').split('?')[0] ?? '';

  if (req.method === 'GET' && (path === '/health' || path === '/')) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', app: APP_NAME }));
    return;
  }

  // F3 route: tenant id in the path, Telegram's secret header as the proof.
  const tenantMatch = WEBHOOK_TENANT_RE.exec(path);
  if (req.method === 'POST' && tenantMatch) {
    const tenantId = tenantMatch[1]!;
    const key = config.webhookSecretKey;
    if (!key) {
      logger.error('SESSION_SECRET unset; cannot verify webhook secret');
      res.writeHead(503, { 'content-type': 'text/plain' });
      res.end('Service Unavailable');
      return;
    }

    const given = req.headers['x-telegram-bot-api-secret-token'];
    if (
      typeof given !== 'string' ||
      !webhookSecretMatches(given, webhookSecretFor(key, tenantId))
    ) {
      // 403, not 404: Telegram stops retrying, and a probe learns nothing
      // beyond "this endpoint exists", which the URL shape already says.
      res.writeHead(403, { 'content-type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    const entry = await registry.getByTenantId(tenantId);
    await dispatch(req, res, entry);
    return;
  }

  // Legacy token-in-path route (pre-F3) — only until every tenant's webhook
  // has been re-set; the warning makes stragglers visible in the logs.
  const legacyMatch = WEBHOOK_LEGACY_RE.exec(path);
  if (req.method === 'POST' && legacyMatch) {
    const token = decodeURIComponent(legacyMatch[1]!);
    const entry = await registry.getByToken(token);
    if (entry) {
      logger.warn(
        { bot: entry.bot.botInfo.username },
        'update on legacy token webhook path — re-set this webhook (F3)',
      );
    }
    await dispatch(req, res, entry);
    return;
  }

  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('Not Found');
}

/** Read the update body and hand it to the resolved bot (shared by both routes). */
async function dispatch(
  req: IncomingMessage,
  res: import('node:http').ServerResponse,
  entry: BotEntry | undefined,
): Promise<void> {
  if (!entry) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not Found');
    return;
  }

  let update: unknown;
  try {
    update = await readJsonBody(req);
  } catch {
    res.writeHead(400, { 'content-type': 'text/plain' });
    res.end('Bad Request');
    return;
  }

  // grammY's error boundary swallows handler errors, so this resolves; we
  // acknowledge with 200 so Telegram doesn't retry a processed update.
  await entry.bot.handleUpdate(
    update as Parameters<typeof entry.bot.handleUpdate>[0],
  );
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end('OK');
}

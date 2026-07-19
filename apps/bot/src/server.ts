/**
 * HTTP server: health check + multi-tenant webhook endpoint. Webhooks are
 * routed by path `/webhook/:botToken`; the (unguessable) token is the shared
 * secret and selects the tenant's bot via the registry (CLAUDE.md rule 2).
 */

import { createServer, type IncomingMessage, type Server } from 'node:http';

import { APP_NAME } from '@kargotrack/shared';

import type { BotConfig } from './config';
import { logger } from './logger';
import type { BotRegistry } from './registry';

const WEBHOOK_RE = /^\/webhook\/(.+)$/;
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
    handle(req, res, registry).catch((err) => {
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
): Promise<void> {
  const path = (req.url ?? '').split('?')[0] ?? '';

  if (req.method === 'GET' && (path === '/health' || path === '/')) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', app: APP_NAME }));
    return;
  }

  const match = WEBHOOK_RE.exec(path);
  if (req.method === 'POST' && match) {
    const token = decodeURIComponent(match[1]!);
    const entry = await registry.getByToken(token);
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
    return;
  }

  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('Not Found');
}

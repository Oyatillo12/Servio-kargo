/**
 * Bot runtime configuration from the environment. Kept dependency-light: the
 * real external inputs (Telegram updates, track codes) are validated by grammY
 * types and `isValidTrackCode`; here we just parse a handful of env vars with
 * clear errors.
 */
import { logger } from './logger';


export interface BotConfig {
  /** HTTP port for the webhook + health server. */
  port: number;
  /** When true, run long-polling instead of webhooks (local dev). */
  polling: boolean;
  /**
   * In polling mode, restrict to the tenant whose `bot_token` equals this value
   * (so a developer can poll a single real BotFather token). If unset, every
   * tenant in the DB is polled.
   */
  pollingToken?: string;
  /** Root directory for warehouse photos (SPEC §3.8 / §7.9). */
  uploadsDir: string;
  /**
   * Platform key the per-tenant webhook `secret_token` is derived from
   * (tasks.md F3) — the same SESSION_SECRET the web app signs cookies with;
   * both containers read it from the one .env. Unset (dev polling) disables
   * the tenant-id webhook route.
   */
  webhookSecretKey?: string;
}

function boolEnv(value: string | undefined): boolean {
  if (!value) return false;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

let cached: BotConfig | undefined;

/** Load config once and reuse it (handlers read `uploadsDir` from here). */
export function getConfig(): BotConfig {
  return (cached ??= loadConfig());
}

export function loadConfig(): BotConfig {
  const portRaw = process.env.PORT ?? '8443';
  const port = Number.parseInt(portRaw, 10);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid PORT: ${portRaw}`);
  }

  if (!process.env.BOT_POLLING_TOKEN && !process.env.BOT_POLLING) {
    logger.warn('BOT_POLLING_TOKEN and BOT_POLLING are both unset; webhook mode will be used');
  }

  const pollingToken = process.env.BOT_POLLING_TOKEN?.trim() || undefined;

  return {
    port,
    polling: boolEnv(process.env.BOT_POLLING),
    pollingToken,
    uploadsDir: process.env.UPLOADS_DIR?.trim() || '/data/uploads',
    webhookSecretKey: process.env.SESSION_SECRET?.trim() || undefined,
  };
}

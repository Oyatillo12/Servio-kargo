/**
 * Minimal Telegram Bot API client used ONLY by the super-admin onboarding flow
 * (SPEC §6): validate a BotFather token via `getMe` and point the bot's webhook
 * at this platform. The webhook path carries the TENANT ID, not the bot token
 * (tasks.md F3) — a token in the URL landed in every proxy access log — and
 * Telegram authenticates with a per-tenant `secret_token` derived from
 * SESSION_SECRET, which the bot server verifies on every update.
 *
 * Every call is bounded by a timeout and returns a discriminated result instead
 * of throwing, so the server action can render a friendly Uzbek error.
 */

import 'server-only';

import { webhookSecretFor } from '@kargotrack/shared/webhook';

const API_BASE = 'https://api.telegram.org';
const TIMEOUT_MS = 10_000;

/** Shape of a Telegram `User` as returned by getMe (subset we use). */
export interface TelegramBotInfo {
  id: number;
  username?: string;
  first_name: string;
}

export type TgResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

interface TgEnvelope<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

async function tgCall<T>(
  token: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<TgResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
      // Never cache Telegram API calls.
      cache: 'no-store',
    });
    const json = (await res.json()) as TgEnvelope<T>;
    if (!json.ok || json.result === undefined) {
      return { ok: false, error: json.description || `HTTP ${res.status}` };
    }
    return { ok: true, data: json.result };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: 'Telegram javob bermadi (timeout)' };
    }
    return { ok: false, error: 'Telegram bilan bogʻlanib boʻlmadi' };
  } finally {
    clearTimeout(timer);
  }
}

/** Validate a token and return the bot's identity (SPEC §6 getMe step). */
export function getMe(token: string): Promise<TgResult<TelegramBotInfo>> {
  return tgCall<TelegramBotInfo>(token, 'getMe');
}

/** Subset of Telegram `getWebhookInfo` we surface in Settings (SPEC §5.7). */
export interface TelegramWebhookInfo {
  /** Empty string when no webhook is set. */
  url: string;
  pending_update_count?: number;
  last_error_message?: string;
}

/** Current webhook state for the connection indicator (Ulangan / Uzilgan). */
export function getWebhookInfo(
  token: string,
): Promise<TgResult<TelegramWebhookInfo>> {
  return tgCall<TelegramWebhookInfo>(token, 'getWebhookInfo');
}

/**
 * Point the bot's webhook at `${base}/webhook/t/${tenantId}` with a derived
 * `secret_token` (tasks.md F3). `base` must be the bot server's public HTTPS
 * origin (WEBHOOK_BASE_URL). Requires SESSION_SECRET — the same key the bot
 * server derives the expected header value from.
 */
export async function setWebhook(
  token: string,
  base: string,
  tenantId: string,
): Promise<TgResult<true>> {
  const platformKey = process.env.SESSION_SECRET;
  if (!platformKey) {
    return { ok: false, error: 'SESSION_SECRET sozlanmagan' };
  }
  const url = `${base.replace(/\/+$/, '')}/webhook/t/${tenantId}`;
  const res = await tgCall<boolean>(token, 'setWebhook', {
    url,
    secret_token: webhookSecretFor(platformKey, tenantId),
    // Only the update types the bot handles (SPEC §3): messages + callbacks.
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: true,
  });
  if (!res.ok) return res;
  return { ok: true, data: true };
}

/**
 * Set the bot's chat menu button to open the tenant's Mini App (tasks.md B7).
 * Applied to the bot's DEFAULT menu button, so it covers every private chat.
 */
export async function setMenuButtonWebApp(
  token: string,
  url: string,
  text: string,
): Promise<TgResult<true>> {
  const res = await tgCall<boolean>(token, 'setChatMenuButton', {
    menu_button: { type: 'web_app', text, web_app: { url } },
  });
  if (!res.ok) return res;
  return { ok: true, data: true };
}

/** Restore the standard command-list menu button (tenant left premium). */
export async function resetMenuButton(token: string): Promise<TgResult<true>> {
  const res = await tgCall<boolean>(token, 'setChatMenuButton', {
    menu_button: { type: 'default' },
  });
  if (!res.ok) return res;
  return { ok: true, data: true };
}

/**
 * Public HTTPS origin of the WEB app (panel + Mini App) — the Mini App lives
 * on the web domain, not the bot's. `APP_URL` wins; otherwise built from
 * `DOMAIN` (always present in the production .env).
 */
export function miniAppUrl(tenantId: string): string | null {
  const explicit = process.env.APP_URL?.trim().replace(/\/+$/, '');
  const domain = process.env.DOMAIN?.trim();
  const origin = explicit || (domain ? `https://${domain}` : null);
  return origin ? `${origin}/m/${tenantId}` : null;
}

/**
 * The public HTTPS origin of the bot server, where Telegram will POST updates.
 * Required for the onboarding flow to auto-set webhooks.
 */
export function webhookBaseUrl(): string {
  const base = process.env.WEBHOOK_BASE_URL?.trim();
  if (!base) {
    throw new Error(
      'WEBHOOK_BASE_URL is not set (public HTTPS origin of the bot server)',
    );
  }
  return base;
}

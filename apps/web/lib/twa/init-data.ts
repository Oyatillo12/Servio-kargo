/**
 * Telegram Mini App `initData` validation (tasks.md B1).
 *
 * Telegram signs the WebApp init data with HMAC-SHA256 keyed off the BOT
 * token, so the check is per-tenant: the same payload is only valid for the
 * bot that opened it. Algorithm (Telegram docs, "Validating data received
 * via the Mini App"):
 *
 *   secret_key       = HMAC_SHA256(key = "WebAppData", message = bot_token)
 *   data_check_string = sorted `key=value` lines of every field except `hash`
 *   valid            ⇔ hex(HMAC_SHA256(secret_key, data_check_string)) == hash
 *
 * No external dependency — ~50 lines of node:crypto beats auditing an SDK.
 */

import crypto from 'node:crypto';

/** Fields we actually consume from a validated payload. */
export interface TwaInitData {
  /** Telegram user id (`user.id`). */
  tgUserId: number;
  /** Unix seconds Telegram issued this payload at. */
  authDate: number;
  firstName: string;
  lastName: string | null;
  username: string | null;
  /** `language_code` as Telegram reports it (NOT our Lang — may be 'en'). */
  languageCode: string | null;
}

/** Reject payloads older than this — a leaked initData shouldn't live long. */
export const INIT_DATA_MAX_AGE_SECONDS = 60 * 60;

function hmac(key: crypto.BinaryLike, message: string): Buffer {
  return crypto.createHmac('sha256', key).update(message).digest();
}

/**
 * Validate a raw `window.Telegram.WebApp.initData` string against one
 * tenant's bot token. Returns the parsed identity, or `null` for ANY defect
 * (bad signature, stale, malformed) — callers never learn which, the caller
 * facing the user only needs "not signed in".
 */
export function validateInitData(
  initData: string,
  botToken: string,
  now: Date = new Date(),
  maxAgeSeconds: number = INIT_DATA_MAX_AGE_SECONDS,
): TwaInitData | null {
  if (!initData || !botToken) return null;

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return null;
  }

  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('\n');

  const secretKey = hmac('WebAppData', botToken);
  const expected = hmac(secretKey, dataCheckString).toString('hex');

  const a = Buffer.from(hash);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate) || authDate <= 0) return null;
  const ageSeconds = Math.floor(now.getTime() / 1000) - authDate;
  if (ageSeconds > maxAgeSeconds || ageSeconds < -60) return null;

  const userRaw = params.get('user');
  if (!userRaw) return null;
  try {
    const user = JSON.parse(userRaw) as {
      id?: unknown;
      first_name?: unknown;
      last_name?: unknown;
      username?: unknown;
      language_code?: unknown;
    };
    if (typeof user.id !== 'number') return null;
    return {
      tgUserId: user.id,
      authDate,
      firstName: typeof user.first_name === 'string' ? user.first_name : '',
      lastName: typeof user.last_name === 'string' ? user.last_name : null,
      username: typeof user.username === 'string' ? user.username : null,
      languageCode:
        typeof user.language_code === 'string' ? user.language_code : null,
    };
  } catch {
    return null;
  }
}

/**
 * Produce a signed initData string the way Telegram would — FOR TESTS ONLY.
 * Lives here (not in the test file) so the test provably exercises the same
 * algorithm the validator implements.
 */
export function signInitDataForTest(
  fields: Record<string, string>,
  botToken: string,
): string {
  const params = new URLSearchParams(fields);
  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('\n');
  const secretKey = hmac('WebAppData', botToken);
  params.set('hash', hmac(secretKey, dataCheckString).toString('hex'));
  return params.toString();
}

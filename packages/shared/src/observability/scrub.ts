/**
 * PII scrubbing for error reports (AUDIT.md T5).
 *
 * Errors are sent to a third-party service (Sentry), but the sales promise to
 * every tenant is that their customer data stays theirs. An exception message or
 * a SQL parameter can easily carry a customer's phone number, a track code, a
 * bot token or a database password — so everything leaving the process passes
 * through {@link scrubText} first.
 *
 * Pure and dependency-free on purpose: both apps share one rule and it is
 * testable without a Sentry client. Redaction is deliberately aggressive — a
 * lost detail in a stack trace costs a little debugging time, a leaked customer
 * phone costs the tenant's trust.
 */

/** Replacement markers, kept distinct so a report still says what was removed. */
export const REDACTED = {
  phone: '[phone]',
  code: '[track-code]',
  token: '[bot-token]',
  secret: '[secret]',
  url: '[url-credentials]',
} as const;

/**
 * Ordered redaction rules. Order matters: bot tokens and connection strings are
 * matched before the generic code/phone patterns, which would otherwise eat
 * parts of them and leave a recognizable remainder.
 */
const RULES: ReadonlyArray<{ pattern: RegExp; replace: string }> = [
  // Telegram bot token: `123456789:AAE...` — also the webhook path secret.
  { pattern: /\b\d{6,12}:[A-Za-z0-9_-]{30,}\b/g, replace: REDACTED.token },
  // Credentials inside a URL: postgres://user:pass@host, https://u:p@host.
  {
    pattern: /\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/gi,
    replace: `$1${REDACTED.url}@`,
  },
  // `secret=...`, `"token": "..."`, `password: ...` in any serialized shape.
  // The key may carry a prefix/suffix (`SESSION_SECRET`, `bot_token`), so the
  // keyword is matched *inside* the identifier — `\bsecret\b` would miss
  // `SESSION_SECRET` because `_` is a word character. Group 1 is the optional
  // quote around the key, group 4 the optional quote around the value; both are
  // put back so the report stays readable.
  {
    pattern:
      /(["']?)([A-Za-z0-9_.-]*(?:password|passwd|secret|token|authorization|api[_-]?key)[A-Za-z0-9_.-]*)\1(\s*[:=]\s*)(["']?)[^\s,;"'}\]]+\4/gi,
    replace: `$1$2$1$3$4${REDACTED.secret}$4`,
  },
  // Uzbek phone numbers, with or without +998 and separators.
  { pattern: /\+?998[\s()-]?\d{2}[\s()-]?\d{3}[\s()-]?\d{2}[\s()-]?\d{2}\b/g, replace: REDACTED.phone },
  // Track codes (SPEC §7.1: 8–20 alphanumerics, upper-case once normalized).
  // Requires at least one digit so ordinary UPPERCASE words are not eaten.
  {
    pattern: /\b(?=[A-Z0-9]{8,20}\b)(?=[A-Z0-9]*\d)[A-Z0-9]+\b/g,
    replace: REDACTED.code,
  },
];

/**
 * Redact anything that looks like customer or credential data. Safe on any
 * string; returns the input unchanged when there is nothing to redact.
 */
export function scrubText(input: string): string {
  let out = input;
  for (const rule of RULES) out = out.replace(rule.pattern, rule.replace);
  return out;
}

/** Keys whose value is dropped wholesale, whatever it looks like. */
const DENY_KEYS = new Set([
  'phone',
  'password',
  'passwordhash',
  'password_hash',
  'bottoken',
  'bot_token',
  'sessionsecret',
  'session_secret',
  'superadmintoken',
  'superadmin_token',
  'databaseurl',
  'database_url',
  'authorization',
  'cookie',
  'fullname',
  'full_name',
]);

/** Depth cap — error payloads can carry cyclic or very deep objects. */
const MAX_DEPTH = 8;

/**
 * Recursively scrub a value of any shape (the JSON body of an error report).
 * Strings are passed through {@link scrubText}, denied keys are dropped, and
 * cycles/over-deep branches collapse to a marker rather than throwing.
 */
export function scrubValue(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') return scrubText(value);
  if (value === null || typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) return '[truncated]';

  const obj = value as object;
  if (seen.has(obj)) return '[circular]';
  seen.add(obj);

  if (Array.isArray(value)) {
    return value.map((item) => scrubValue(item, depth + 1, seen));
  }

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (DENY_KEYS.has(key.toLowerCase())) {
      out[key] = REDACTED.secret;
      continue;
    }
    out[key] = scrubValue(val, depth + 1, seen);
  }
  return out;
}

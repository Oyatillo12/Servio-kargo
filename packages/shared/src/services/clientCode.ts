/**
 * Client-code assignment (CLAUDE.md customers.client_code, SPEC §3.1).
 *
 * `client_code = <tenant code_prefix> + '-' + <per-tenant sequence>`,
 * e.g. `DK-1042`. Sequences start at 1001 and increase by one. The caller
 * passes the existing client_codes for the tenant; we take the max trailing
 * number and return the next one. Uniqueness is still enforced by the
 * `customers_tenant_client_code_uq` index — the caller retries on collision.
 */

/** First sequence number handed out (so the very first customer is prefix-1001). */
export const CLIENT_CODE_SEQ_BASE = 1000;

/**
 * Compute the next client_code for a tenant given its existing codes.
 * Parses the trailing integer of each code (ignoring the prefix) and returns
 * `prefix-(max+1)`, or `prefix-1001` when there are none.
 */
export function nextClientCode(
  prefix: string,
  existingCodes: string[],
): string {
  let max = CLIENT_CODE_SEQ_BASE;
  for (const code of existingCodes) {
    const m = /(\d+)\s*$/.exec(code);
    if (!m) continue;
    const n = Number.parseInt(m[1]!, 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}-${max + 1}`;
}

/**
 * Does this scanned string look like a client code rather than a track code
 * (SPEC §3.14, §5.14 — tasks.md L2)?
 *
 * One scanner at the weighing desk reads both: a parcel's barcode and a
 * customer's QR card. Asking the operator to pick a mode is the wrong question
 * when the shapes already differ — a client code is `PREFIX-1042` (2–4 letters,
 * an optional dash, then digits), while a track code is 8–20 alphanumerics
 * with digits and letters mixed throughout (§7.1).
 *
 * Deliberately narrow: anything that does not clearly match falls through to
 * the track-code path, which is the safe default (a mistaken track code is
 * rejected as "not found", a mistaken marka could attribute a parcel).
 */
export function looksLikeClientCode(value: string): boolean {
  return /^[A-Za-z]{2,4}-?\d{1,10}$/.test(value.trim());
}

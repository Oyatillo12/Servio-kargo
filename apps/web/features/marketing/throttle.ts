/**
 * In-memory sliding-window rate limiter for the public lead form.
 *
 * The web app runs as a single Node process in one container, so process
 * memory is the correct scope; state resets on deploy/restart, which for a
 * spam throttle is fine. Pure function over an injected clock for testability.
 */

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;
/** Hard cap on tracked keys so a spray of spoofed IPs can't grow the map. */
const MAX_KEYS = 10_000;

const hits = new Map<string, number[]>();

/**
 * Record an attempt for `key` (an IP) and report whether it is allowed.
 * Returns false once the key exceeds MAX_PER_WINDOW within WINDOW_MS.
 */
export function allowLead(key: string, now = Date.now()): boolean {
  const cutoff = now - WINDOW_MS;
  const prev = (hits.get(key) ?? []).filter((t) => t > cutoff);

  if (prev.length >= MAX_PER_WINDOW) {
    hits.set(key, prev);
    return false;
  }

  if (!hits.has(key) && hits.size >= MAX_KEYS) {
    // Drop expired entries; if the map is still full, fail open — losing a
    // throttle beats losing a lead.
    for (const [k, ts] of hits) {
      if (!ts.some((t) => t > cutoff)) hits.delete(k);
    }
    if (hits.size >= MAX_KEYS) return true;
  }

  prev.push(now);
  hits.set(key, prev);
  return true;
}

/** Test hook. */
export function resetLeadThrottle(): void {
  hits.clear();
}

/**
 * Inbound update throttle (tasks.md F2).
 *
 * The outbound `rateLimiter.ts` protects us from Telegram's send limits; this
 * protects the process and the database from the sender: every free-text
 * message costs 2+ DB round-trips (session + tenant/customer load) and a
 * track-code lookup, so an unthrottled chat is a cheap DoS and a code-
 * enumeration channel (F1's limited card shrinks what enumeration yields;
 * this shrinks how fast it can be tried).
 *
 * Fixed windows, in memory, per bot process — the same trade-off as
 * `auth_throttle` but without Postgres, because the whole point is to shed
 * load BEFORE the first DB query. Limits are per (tenant, chat) with a coarse
 * per-tenant ceiling so one tenant's flood cannot crowd out the others.
 * Exceeding updates are dropped silently: replying "slow down" would itself
 * be outbound spam, and Telegram already got its 200.
 */

/** One fixed window per key. */
interface Window {
  start: number;
  count: number;
}

/** A normal person taps far below this; a USB-scanner staff burst fits too. */
export const MAX_PER_CHAT_PER_MIN = 25;
/** Whole-tenant ceiling across all chats — a botnet, not a busy day. */
export const MAX_PER_TENANT_PER_MIN = 400;

const WINDOW_MS = 60_000;
/** Memory bound: beyond this, expired windows are purged (then oldest). */
const MAX_TRACKED = 10_000;

export class InboundLimiter {
  private chats = new Map<string, Window>();
  private tenants = new Map<string, Window>();

  constructor(
    private maxPerChat = MAX_PER_CHAT_PER_MIN,
    private maxPerTenant = MAX_PER_TENANT_PER_MIN,
  ) {}

  /** Whether this update may proceed. Counts the attempt either way. */
  allow(tenantId: string, chatId: number, now = Date.now()): boolean {
    const tenantOk = this.bump(this.tenants, tenantId, this.maxPerTenant, now);
    const chatOk = this.bump(
      this.chats,
      `${tenantId}:${chatId}`,
      this.maxPerChat,
      now,
    );
    return tenantOk && chatOk;
  }

  private bump(
    map: Map<string, Window>,
    key: string,
    max: number,
    now: number,
  ): boolean {
    let w = map.get(key);
    if (!w || now - w.start >= WINDOW_MS) {
      // Delete-then-set keeps Map insertion order ≈ recency, so the eviction
      // below drops the stalest keys first.
      map.delete(key);
      w = { start: now, count: 0 };
      map.set(key, w);
    }
    w.count += 1;

    if (map.size > MAX_TRACKED) this.evict(map, now);
    return w.count <= max;
  }

  private evict(map: Map<string, Window>, now: number): void {
    for (const [key, w] of map) {
      if (now - w.start >= WINDOW_MS) map.delete(key);
    }
    // Still over after dropping expired windows: shed the oldest entries.
    // Losing a counter fails open (one extra window) — acceptable; unbounded
    // memory is not.
    if (map.size > MAX_TRACKED) {
      for (const key of map.keys()) {
        map.delete(key);
        if (map.size <= MAX_TRACKED) break;
      }
    }
  }
}

/** One limiter for the whole process: the per-tenant map must span all bots. */
export const inboundLimiter = new InboundLimiter();

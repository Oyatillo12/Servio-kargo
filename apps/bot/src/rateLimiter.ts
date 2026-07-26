/**
 * Telegram send throttle (SPEC §8, CLAUDE.md rule 3): ≤25 msg/sec globally and
 * ≤1 msg/sec per chat. Each sender calls {@link acquire} before a send; it
 * books the earliest free slot and sleeps until then.
 *
 * Two things this gets right, both of them AUDIT.md T3 findings:
 *
 * **The budget is per bot, not per process (F4).** Telegram applies its limits
 * to a bot token, and this codebase runs one bot per tenant (CLAUDE.md rule 2),
 * so a single shared counter silently divides the allowance by the number of
 * tenants: with 5 cargo companies each gets 5 msg/s, and one company's
 * 3 000-recipient broadcast parks every other company's "yukingiz tayyor"
 * behind it. Slots are booked in a bucket keyed by bot token. The per-chat
 * window lives inside the bucket too, which is also more correct — a customer
 * who buys from two cargo companies talks to two different bots, and the 1/sec
 * applies to each (bot, chat) pair separately.
 *
 * **A chat-deferred send must not drag the global schedule with it (F3).** The
 * obvious implementation keeps one `globalNext` mark and advances it to
 * `grantedAt + 40ms`. Grant a send at t=1000 because that chat just got a
 * message, and the mark jumps to 1040 — so 24 unrelated customers who could
 * have been messaged in that second are pushed behind it. Customers routinely
 * have several parcels, so a bulk status change is full of same-chat repeats:
 * measured over 500 notifications for 300 customers (100 of them with 3
 * parcels), that scheduler alone finishes in 212 s — 2.4 msg/s against a
 * 25 msg/s ceiling. Instead the schedule is a set of booked 40 ms slots: a
 * deferred send takes a slot far ahead without disturbing the near ones, and
 * the cursor keeps handing the near slots to other chats.
 *
 * One instance is shared by all queue workers (notify, reminder, broadcast).
 * Slots are reserved synchronously before any await, so concurrent acquires —
 * which is the point of the batched workers — each get a distinct slot.
 */

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Booked slots start being pruned once a bucket holds this many. */
const PRUNE_THRESHOLD = 5000;

/** Per-bot booking state. */
interface Bucket {
  /**
   * Booked slot indices; slot `i` means "a send goes out at `i * globalGapMs`"
   * (absolute epoch ms, so the grid is stable across calls).
   */
  taken: Set<number>;
  /** Lowest slot index not known to be taken — where a scan starts. */
  cursor: number;
  /** Earliest instant per chat id, from the 1/sec per-chat rule. */
  chatNext: Map<number, number>;
}

export class TelegramRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    /** ~25/sec → 40ms min spacing between any two sends by the same bot. */
    private readonly globalGapMs = 40,
    /** 1/sec per (bot, chat). */
    private readonly chatGapMs = 1000,
  ) {}

  /**
   * Wait until `botToken` may send to `chatId`, reserving the slot first.
   *
   * @param botToken the sending tenant's bot token — the rate-limit budget key.
   */
  async acquire(botToken: string, chatId: number): Promise<void> {
    const now = Date.now();
    const bucket = this.bucketFor(botToken);

    // The cursor never points into the past, so an idle bot starts fresh.
    const nowSlot = Math.ceil(now / this.globalGapMs);
    if (bucket.cursor < nowSlot) bucket.cursor = nowSlot;

    const earliest = Math.max(now, bucket.chatNext.get(chatId) ?? 0);
    let slot = Math.max(Math.ceil(earliest / this.globalGapMs), bucket.cursor);
    while (bucket.taken.has(slot)) slot++;

    // Reserve BEFORE sleeping: while one caller awaits its slot, a concurrent
    // acquire must already see the booking, or both would take the same slot.
    bucket.taken.add(slot);
    while (bucket.taken.has(bucket.cursor)) bucket.cursor++;

    const at = slot * this.globalGapMs;
    bucket.chatNext.set(chatId, at + this.chatGapMs);
    this.prune(bucket, now, nowSlot);

    const wait = at - now;
    if (wait > 0) await sleep(wait);
  }

  private bucketFor(botToken: string): Bucket {
    let bucket = this.buckets.get(botToken);
    if (!bucket) {
      bucket = { taken: new Set(), cursor: 0, chatNext: new Map() };
      this.buckets.set(botToken, bucket);
    }
    return bucket;
  }

  /** Drop bookings and chat windows that have fully elapsed, to bound memory. */
  private prune(bucket: Bucket, now: number, nowSlot: number): void {
    if (bucket.taken.size >= PRUNE_THRESHOLD) {
      for (const slot of bucket.taken) {
        if (slot < nowSlot) bucket.taken.delete(slot);
      }
    }
    if (bucket.chatNext.size >= PRUNE_THRESHOLD) {
      for (const [chatId, ready] of bucket.chatNext) {
        if (ready <= now) bucket.chatNext.delete(chatId);
      }
    }
  }
}

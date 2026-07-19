/**
 * Telegram send throttle (SPEC §8, CLAUDE.md rule 3): ≤25 msg/sec globally and
 * ≤1 msg/sec per chat. A single sequential worker calls {@link acquire} before
 * each send; it reserves the next global + per-chat slot and sleeps until then.
 *
 * A same-chat burst serializes at 1/sec (acceptable at MVP scale); other chats
 * are still bounded only by the 40ms global spacing.
 */

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class TelegramRateLimiter {
  private globalNext = 0;
  private readonly chatNext = new Map<number, number>();

  constructor(
    /** ~25/sec → 40ms min spacing between any two sends. */
    private readonly globalGapMs = 40,
    /** 1/sec per chat. */
    private readonly chatGapMs = 1000,
  ) {}

  /** Wait until a slot is free for `chatId`, reserving global + per-chat slots. */
  async acquire(chatId: number): Promise<void> {
    const now = Date.now();
    const chatReady = this.chatNext.get(chatId) ?? 0;
    const at = Math.max(now, this.globalNext, chatReady);

    const wait = at - now;
    if (wait > 0) await sleep(wait);

    this.globalNext = at + this.globalGapMs;
    this.chatNext.set(chatId, at + this.chatGapMs);
    this.prune(at);
  }

  /** Drop per-chat entries whose window has fully elapsed, to bound memory. */
  private prune(now: number): void {
    if (this.chatNext.size < 5000) return;
    for (const [chatId, ready] of this.chatNext) {
      if (ready <= now) this.chatNext.delete(chatId);
    }
  }
}

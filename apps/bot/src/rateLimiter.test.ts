import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TelegramRateLimiter } from './rateLimiter';

const BOT_A = '111:AAA';
const BOT_B = '222:BBB';

/** Acquire a slot and record the (fake) clock reading at which it was granted. */
function acquireAt(
  limiter: TelegramRateLimiter,
  token: string,
  chatId: number,
  log: number[],
): Promise<void> {
  return limiter.acquire(token, chatId).then(() => {
    log.push(Date.now());
  });
}

/** Run pending acquires to completion, driving the fake clock forward. */
async function settle(pending: Promise<unknown>[]): Promise<void> {
  const all = Promise.all(pending);
  await vi.runAllTimersAsync();
  await all;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('global spacing (≈25 msg/sec)', () => {
  it('grants the first slot immediately', async () => {
    const limiter = new TelegramRateLimiter();
    const log: number[] = [];
    await settle([acquireAt(limiter, BOT_A, 1, log)]);
    expect(log).toEqual([0]);
  });

  it('spaces sequential sends 40ms apart', async () => {
    const limiter = new TelegramRateLimiter();
    const log: number[] = [];
    await settle([
      acquireAt(limiter, BOT_A, 1, log),
      acquireAt(limiter, BOT_A, 2, log),
      acquireAt(limiter, BOT_A, 3, log),
    ]);
    expect(log).toEqual([0, 40, 80]);
  });

  it('books a distinct slot for every concurrent acquire', async () => {
    // The batched workers (AUDIT.md T3) call acquire from many jobs at once.
    // Reserving before sleeping is what stops two of them booking one slot.
    const limiter = new TelegramRateLimiter();
    const log: number[] = [];
    await settle(
      Array.from({ length: 100 }, (_, i) => acquireAt(limiter, BOT_A, i, log)),
    );

    expect(log).toHaveLength(100);
    expect(new Set(log).size).toBe(100);
    const sorted = [...log].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i]! - sorted[i - 1]!).toBeGreaterThanOrEqual(40);
    }
  });

  it('stays under 25 sends per second for one bot', async () => {
    const limiter = new TelegramRateLimiter();
    const log: number[] = [];
    await settle(
      Array.from({ length: 60 }, (_, i) => acquireAt(limiter, BOT_A, i, log)),
    );

    for (const at of log) {
      const inSameSecond = log.filter((t) => t >= at && t < at + 1000).length;
      expect(inSameSecond).toBeLessThanOrEqual(25);
    }
  });
});

describe('per-chat spacing (1 msg/sec)', () => {
  it('serializes a burst to one chat at 1/sec', async () => {
    const limiter = new TelegramRateLimiter();
    const log: number[] = [];
    await settle([
      acquireAt(limiter, BOT_A, 7, log),
      acquireAt(limiter, BOT_A, 7, log),
      acquireAt(limiter, BOT_A, 7, log),
    ]);
    expect(log).toEqual([0, 1000, 2000]);
  });

  it('does not hold up other chats while one chat waits', async () => {
    const limiter = new TelegramRateLimiter();
    const log: number[] = [];
    await settle([
      acquireAt(limiter, BOT_A, 7, log),
      acquireAt(limiter, BOT_A, 7, log), // parked until 1000
      acquireAt(limiter, BOT_A, 8, log),
    ]);
    // The parked send books a slot a second out; chat 8 still gets the next
    // free near slot rather than queueing behind it (AUDIT.md F3).
    expect(log.sort((a, b) => a - b)).toEqual([0, 40, 1000]);
  });

  it('keeps a burst of repeat chats near the 25/sec ceiling', async () => {
    // 500 notifications for 300 customers, 100 of whom have 3 parcels — the
    // shape of a bulk status change. A scheduler that advances one global mark
    // past every per-chat deferral finishes this in 212 s (2.4 msg/s).
    const limiter = new TelegramRateLimiter();
    const log: number[] = [];
    const chats: number[] = [];
    for (let i = 0; i < 200; i++) chats.push(i);
    for (let i = 200; i < 300; i++) chats.push(i, i, i);

    await settle(chats.map((chat) => acquireAt(limiter, BOT_A, chat, log)));

    expect(log).toHaveLength(500);
    // 500 messages at 25/sec has a 20 s floor; allow the per-chat spacing a
    // little slack, but nothing like the 212 s the naive schedule took.
    expect(Math.max(...log)).toBeLessThanOrEqual(22_000);
  });

  it('never books two sends into the same slot, even with repeat chats', async () => {
    const limiter = new TelegramRateLimiter();
    const log: number[] = [];
    const chats = Array.from({ length: 300 }, (_, i) => i % 60);

    await settle(chats.map((chat) => acquireAt(limiter, BOT_A, chat, log)));

    expect(new Set(log).size).toBe(log.length);
    const sorted = [...log].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i]! - sorted[i - 1]!).toBeGreaterThanOrEqual(40);
    }
  });

  it('still honours 1/sec per chat when chats repeat', async () => {
    const limiter = new TelegramRateLimiter();
    const perChat = new Map<number, number[]>();
    const chats = Array.from({ length: 300 }, (_, i) => i % 60);

    await settle(
      chats.map((chat) =>
        limiter.acquire(BOT_A, chat).then(() => {
          const times = perChat.get(chat) ?? [];
          times.push(Date.now());
          perChat.set(chat, times);
        }),
      ),
    );

    expect(perChat.size).toBe(60);
    for (const times of perChat.values()) {
      const sorted = [...times].sort((a, b) => a - b);
      expect(sorted).toHaveLength(5);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i]! - sorted[i - 1]!).toBeGreaterThanOrEqual(1000);
      }
    }
  });
});

describe('per-bot fairness (AUDIT.md F4)', () => {
  it('gives each bot its own global budget', async () => {
    // The bug this replaces: one shared counter meant N tenants split
    // Telegram's per-bot allowance N ways.
    const limiter = new TelegramRateLimiter();
    const a: number[] = [];
    const b: number[] = [];
    await settle([
      acquireAt(limiter, BOT_A, 1, a),
      acquireAt(limiter, BOT_A, 2, a),
      acquireAt(limiter, BOT_A, 3, a),
      acquireAt(limiter, BOT_B, 1, b),
      acquireAt(limiter, BOT_B, 2, b),
      acquireAt(limiter, BOT_B, 3, b),
    ]);
    expect(a).toEqual([0, 40, 80]);
    expect(b).toEqual([0, 40, 80]);
  });

  it("keeps one tenant's broadcast from delaying another's notification", async () => {
    const limiter = new TelegramRateLimiter();
    const broadcast: number[] = [];
    const notify: number[] = [];

    const pending = Array.from({ length: 200 }, (_, i) =>
      acquireAt(limiter, BOT_A, i, broadcast),
    );
    pending.push(acquireAt(limiter, BOT_B, 1, notify));
    await settle(pending);

    // 200 messages queued on bot A span 8 seconds; bot B goes out at once.
    expect(Math.max(...broadcast)).toBeGreaterThanOrEqual(7960);
    expect(notify).toEqual([0]);
  });

  it('tracks the per-chat window per (bot, chat) pair', async () => {
    // A customer of two cargo companies has the same Telegram id on both bots;
    // Telegram's 1/sec applies to each bot separately.
    const limiter = new TelegramRateLimiter();
    const log: number[] = [];
    await settle([
      acquireAt(limiter, BOT_A, 42, log),
      acquireAt(limiter, BOT_B, 42, log),
    ]);
    expect(log).toEqual([0, 0]);
  });
});

describe('memory', () => {
  it('prunes elapsed bookings and chat windows instead of growing forever', () => {
    const limiter = new TelegramRateLimiter();
    // Booking is synchronous, so state is observable without draining the
    // sleeps — which here would span a quarter of an hour of fake time.
    for (let i = 0; i < 5100; i++) void limiter.acquire(BOT_A, i);

    const bucket = (
      limiter as unknown as {
        buckets: Map<string, { taken: Set<number>; chatNext: Map<number, number> }>;
      }
    ).buckets.get(BOT_A)!;
    expect(bucket.taken.size).toBe(5100);
    expect(bucket.chatNext.size).toBe(5100);

    // Long after every window has closed, the next acquire sweeps them out.
    vi.setSystemTime(600_000);
    void limiter.acquire(BOT_A, 999_999);

    expect(bucket.taken.size).toBeLessThan(5100);
    expect(bucket.chatNext.size).toBeLessThan(5100);
  });
});

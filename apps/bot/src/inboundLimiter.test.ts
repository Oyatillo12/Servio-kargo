import { describe, expect, it } from 'vitest';

import { InboundLimiter } from './inboundLimiter';

const T0 = 1_000_000;

describe('InboundLimiter', () => {
  it('allows a normal conversation and blocks a flood in the same window', () => {
    const limiter = new InboundLimiter(5, 100);
    for (let i = 0; i < 5; i++) {
      expect(limiter.allow('tenant-a', 1, T0 + i)).toBe(true);
    }
    expect(limiter.allow('tenant-a', 1, T0 + 5)).toBe(false);
  });

  it('resets after the window passes', () => {
    const limiter = new InboundLimiter(2, 100);
    expect(limiter.allow('t', 1, T0)).toBe(true);
    expect(limiter.allow('t', 1, T0)).toBe(true);
    expect(limiter.allow('t', 1, T0)).toBe(false);
    expect(limiter.allow('t', 1, T0 + 60_000)).toBe(true);
  });

  it('throttles chats independently', () => {
    const limiter = new InboundLimiter(1, 100);
    expect(limiter.allow('t', 1, T0)).toBe(true);
    expect(limiter.allow('t', 1, T0)).toBe(false);
    // A different person is not punished for chat 1's flood.
    expect(limiter.allow('t', 2, T0)).toBe(true);
  });

  it('caps a tenant across many chats — a botnet, not one loud chat', () => {
    const limiter = new InboundLimiter(10, 3);
    expect(limiter.allow('t', 1, T0)).toBe(true);
    expect(limiter.allow('t', 2, T0)).toBe(true);
    expect(limiter.allow('t', 3, T0)).toBe(true);
    expect(limiter.allow('t', 4, T0)).toBe(false);
  });

  it("one tenant's flood does not throttle another tenant", () => {
    const limiter = new InboundLimiter(10, 1);
    expect(limiter.allow('flooded', 1, T0)).toBe(true);
    expect(limiter.allow('flooded', 2, T0)).toBe(false);
    expect(limiter.allow('quiet', 1, T0)).toBe(true);
  });
});

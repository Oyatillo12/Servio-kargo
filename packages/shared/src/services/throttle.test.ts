import { describe, expect, it } from 'vitest';

import {
  INVITE_IP_THROTTLE,
  isThrottled,
  LOGIN_IP_THROTTLE,
  LOGIN_PHONE_THROTTLE,
  SA_LOGIN_THROTTLE,
  throttleKey,
} from './throttle';

describe('throttleKey', () => {
  it('prefixes the scope and lowercases the identifier', () => {
    expect(throttleKey('login', '+998901234567')).toBe('login:+998901234567');
    expect(throttleKey('ip', '203.0.113.7')).toBe('ip:203.0.113.7');
  });

  it('collapses spacing so one phone lands on one counter', () => {
    expect(throttleKey('login', ' +998 90 123 45 67 ')).toBe(
      throttleKey('login', '+998901234567'),
    );
  });

  it('buckets missing identifiers instead of skipping throttling', () => {
    expect(throttleKey('sa', undefined)).toBe('sa:unknown');
    expect(throttleKey('sa', null)).toBe('sa:unknown');
    expect(throttleKey('sa', '   ')).toBe('sa:unknown');
  });
});

describe('isThrottled', () => {
  it('allows attempts up to and including the ceiling', () => {
    expect(isThrottled(LOGIN_PHONE_THROTTLE.maxAttempts, LOGIN_PHONE_THROTTLE)).toBe(false);
    expect(isThrottled(1, SA_LOGIN_THROTTLE)).toBe(false);
  });

  it('blocks the attempt after the ceiling', () => {
    expect(isThrottled(LOGIN_PHONE_THROTTLE.maxAttempts + 1, LOGIN_PHONE_THROTTLE)).toBe(true);
    expect(isThrottled(SA_LOGIN_THROTTLE.maxAttempts + 1, SA_LOGIN_THROTTLE)).toBe(true);
  });

  it('per-IP login ceiling is looser than per-phone (shared office NAT)', () => {
    expect(LOGIN_IP_THROTTLE.maxAttempts).toBeGreaterThan(LOGIN_PHONE_THROTTLE.maxAttempts);
    expect(INVITE_IP_THROTTLE.maxAttempts).toBeGreaterThan(SA_LOGIN_THROTTLE.maxAttempts);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSessionToken } from '../session';

import {
  createTwaSessionToken,
  TWA_MAX_AGE_SECONDS,
  verifyTwaSessionToken,
} from './session';

const TENANT = '11111111-1111-1111-1111-111111111111';
const CUSTOMER = '22222222-2222-2222-2222-222222222222';

beforeEach(() => {
  process.env.SESSION_SECRET = 'test-secret-at-least-16-chars-long';
});

afterEach(() => {
  vi.useRealTimers();
});

describe('TWA session token', () => {
  it('round-trips tenant and customer', () => {
    const token = createTwaSessionToken(TENANT, CUSTOMER);
    expect(verifyTwaSessionToken(token)).toEqual({
      tenantId: TENANT,
      customerId: CUSTOMER,
    });
  });

  it('rejects tampering', () => {
    const token = createTwaSessionToken(TENANT, CUSTOMER);
    const [payload, sig] = token.split('.');
    const other = Buffer.from(
      JSON.stringify({
        t: TENANT,
        c: '33333333-3333-3333-3333-333333333333',
        exp: Math.floor(Date.now() / 1000) + 1000,
      }),
    ).toString('base64url');
    expect(verifyTwaSessionToken(`${other}.${sig}`)).toBeNull();
    expect(verifyTwaSessionToken(`${payload}.`)).toBeNull();
    expect(verifyTwaSessionToken(undefined)).toBeNull();
  });

  it('expires', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-10T12:00:00Z'));
    const token = createTwaSessionToken(TENANT, CUSTOMER);
    vi.setSystemTime(
      new Date(Date.now() + (TWA_MAX_AGE_SECONDS + 60) * 1000),
    );
    expect(verifyTwaSessionToken(token)).toBeNull();
  });

  it('never accepts an ADMIN session token (domain separation)', () => {
    // Same SESSION_SECRET signs both families; the context prefix must keep
    // them disjoint even if payload shapes ever converged.
    const adminToken = createSessionToken(TENANT, 0);
    expect(verifyTwaSessionToken(adminToken)).toBeNull();
  });
});

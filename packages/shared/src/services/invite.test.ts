import { describe, expect, it } from 'vitest';

import {
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  INVITE_TTL_MS,
  MIN_PASSWORD_LENGTH,
  checkInvite,
  formatInviteCode,
  generateInviteCode,
  inviteExpiry,
  isValidPassword,
  normalizeInviteCode,
} from './invite';

/** Deterministic byte source, so a generated code can be asserted exactly. */
const bytesFrom = (values: number[]) => (size: number) =>
  Uint8Array.from({ length: size }, (_, i) => values[i % values.length] ?? 0);

describe('INVITE_CODE_ALPHABET', () => {
  it('divides 256 evenly, so byte % length carries no modulo bias', () => {
    expect(256 % INVITE_CODE_ALPHABET.length).toBe(0);
  });

  it('omits every character pair that gets misheard or mistyped', () => {
    // Codes are dictated over the phone from a noisy warehouse.
    for (const ch of ['O', '0', 'I', '1']) {
      expect(INVITE_CODE_ALPHABET).not.toContain(ch);
    }
  });

  it('has no duplicate symbols', () => {
    expect(new Set(INVITE_CODE_ALPHABET).size).toBe(
      INVITE_CODE_ALPHABET.length,
    );
  });
});

describe('generateInviteCode', () => {
  it('maps each byte through the alphabet', () => {
    expect(generateInviteCode(bytesFrom([0]))).toBe('AAAAAA');
    expect(generateInviteCode(bytesFrom([0, 1, 2, 3, 4, 5]))).toBe('ABCDEF');
  });

  it('wraps bytes past the alphabet length', () => {
    // 32 % 32 = 0 → 'A'; 33 % 32 = 1 → 'B'.
    expect(generateInviteCode(bytesFrom([32, 33, 0, 0, 0, 0]))).toBe('ABAAAA');
  });

  it('produces a code of exactly INVITE_CODE_LENGTH', () => {
    expect(generateInviteCode(bytesFrom([7, 11, 19]))).toHaveLength(
      INVITE_CODE_LENGTH,
    );
  });

  it('only ever emits alphabet characters', () => {
    for (let seed = 0; seed < 256; seed += 1) {
      for (const ch of generateInviteCode(bytesFrom([seed]))) {
        expect(INVITE_CODE_ALPHABET).toContain(ch);
      }
    }
  });

  it('round-trips through normalizeInviteCode', () => {
    const code = generateInviteCode(bytesFrom([5, 9, 14, 21, 28, 31]));
    expect(normalizeInviteCode(formatInviteCode(code))).toBe(code);
  });
});

describe('normalizeInviteCode', () => {
  it('accepts the code exactly as generated', () => {
    expect(normalizeInviteCode('ABC234')).toBe('ABC234');
  });

  it('accepts what people actually type back', () => {
    // Shown grouped as ABC-234, so the dash comes back with it; phone keyboards
    // add spaces and autocorrect lower-cases the lot.
    expect(normalizeInviteCode('abc-234')).toBe('ABC234');
    expect(normalizeInviteCode(' ABC 234 ')).toBe('ABC234');
    expect(normalizeInviteCode('a-b-c-2-3-4')).toBe('ABC234');
  });

  it('rejects a wrong length', () => {
    expect(normalizeInviteCode('ABC23')).toBeNull();
    expect(normalizeInviteCode('ABC2345')).toBeNull();
    expect(normalizeInviteCode('')).toBeNull();
  });

  it('rejects characters outside the alphabet', () => {
    // Not silently coerced: 'O' vs '0' guessing would hand someone another
    // person's invite. The alphabet excludes both, so this is always a typo.
    expect(normalizeInviteCode('ABC23O')).toBeNull();
    expect(normalizeInviteCode('ABC231')).toBeNull();
  });
});

describe('formatInviteCode', () => {
  it('splits the code in half with a dash', () => {
    expect(formatInviteCode('ABC234')).toBe('ABC-234');
  });

  it('handles an odd length by weighting the first group', () => {
    expect(formatInviteCode('ABCDE')).toBe('ABC-DE');
  });
});

describe('checkInvite', () => {
  const now = new Date('2026-07-27T09:00:00.000Z');
  const live = {
    expiresAt: new Date('2026-07-28T09:00:00.000Z'),
    acceptedAt: null,
  };

  it('accepts a live invite', () => {
    expect(checkInvite(live, now)).toBeNull();
  });

  it('reports an expired invite', () => {
    expect(
      checkInvite(
        { ...live, expiresAt: new Date('2026-07-27T08:59:59.999Z') },
        now,
      ),
    ).toBe('expired');
  });

  it('treats the exact expiry instant as expired', () => {
    expect(checkInvite({ ...live, expiresAt: now }, now)).toBe('expired');
  });

  it('reports a used invite before an expiry check', () => {
    // A code that was already redeemed is "used" even after it also expired —
    // the two need different messages, and "already used" is the true story.
    expect(
      checkInvite(
        {
          expiresAt: new Date('2026-07-01T09:00:00.000Z'),
          acceptedAt: new Date('2026-07-01T08:00:00.000Z'),
        },
        now,
      ),
    ).toBe('used');
  });
});

describe('inviteExpiry', () => {
  it('is exactly INVITE_TTL_MS after creation', () => {
    const now = new Date('2026-07-27T09:00:00.000Z');
    expect(inviteExpiry(now).getTime() - now.getTime()).toBe(INVITE_TTL_MS);
    expect(inviteExpiry(now).toISOString()).toBe('2026-07-28T09:00:00.000Z');
  });
});

describe('isValidPassword', () => {
  it('requires MIN_PASSWORD_LENGTH characters', () => {
    expect(isValidPassword('a'.repeat(MIN_PASSWORD_LENGTH))).toBe(true);
    expect(isValidPassword('a'.repeat(MIN_PASSWORD_LENGTH - 1))).toBe(false);
    expect(isValidPassword('')).toBe(false);
  });
});

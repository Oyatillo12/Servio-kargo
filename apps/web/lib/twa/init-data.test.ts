import { describe, expect, it } from 'vitest';

import { signInitDataForTest, validateInitData } from './init-data';

const BOT_TOKEN = '123456789:AAFakeTokenForTests_abcdefghijklmnop';
const NOW = new Date('2026-08-10T12:00:00Z');
const NOW_SECONDS = Math.floor(NOW.getTime() / 1000);

function freshFields(overrides: Record<string, string> = {}) {
  return {
    auth_date: String(NOW_SECONDS - 30),
    query_id: 'AAH0000000000000000000',
    user: JSON.stringify({
      id: 987654321,
      first_name: 'Aziz',
      last_name: 'Karimov',
      username: 'aziz',
      language_code: 'uz',
    }),
    ...overrides,
  };
}

describe('validateInitData', () => {
  it('accepts a correctly signed payload and parses the identity', () => {
    const initData = signInitDataForTest(freshFields(), BOT_TOKEN);
    const result = validateInitData(initData, BOT_TOKEN, NOW);
    expect(result).toEqual({
      tgUserId: 987654321,
      authDate: NOW_SECONDS - 30,
      firstName: 'Aziz',
      lastName: 'Karimov',
      username: 'aziz',
      languageCode: 'uz',
    });
  });

  it('rejects a payload signed by a DIFFERENT bot (per-tenant isolation)', () => {
    const initData = signInitDataForTest(freshFields(), BOT_TOKEN);
    expect(
      validateInitData(initData, '999:OtherTenantBotToken_qrstuvwxyz', NOW),
    ).toBeNull();
  });

  it('rejects a tampered payload', () => {
    const initData = signInitDataForTest(freshFields(), BOT_TOKEN);
    const tampered = initData.replace('987654321', '111111111');
    expect(validateInitData(tampered, BOT_TOKEN, NOW)).toBeNull();
  });

  it('rejects a stale payload (leaked initData must die quickly)', () => {
    const initData = signInitDataForTest(
      freshFields({ auth_date: String(NOW_SECONDS - 2 * 60 * 60) }),
      BOT_TOKEN,
    );
    expect(validateInitData(initData, BOT_TOKEN, NOW)).toBeNull();
  });

  it('tolerates small clock skew but rejects far-future auth_date', () => {
    const slightSkew = signInitDataForTest(
      freshFields({ auth_date: String(NOW_SECONDS + 30) }),
      BOT_TOKEN,
    );
    expect(validateInitData(slightSkew, BOT_TOKEN, NOW)).not.toBeNull();

    const farFuture = signInitDataForTest(
      freshFields({ auth_date: String(NOW_SECONDS + 600) }),
      BOT_TOKEN,
    );
    expect(validateInitData(farFuture, BOT_TOKEN, NOW)).toBeNull();
  });

  it('rejects missing hash, missing user and empty input', () => {
    expect(validateInitData('', BOT_TOKEN, NOW)).toBeNull();
    expect(validateInitData('auth_date=1', BOT_TOKEN, NOW)).toBeNull();
    const noUser = signInitDataForTest(
      { auth_date: String(NOW_SECONDS - 5) },
      BOT_TOKEN,
    );
    expect(validateInitData(noUser, BOT_TOKEN, NOW)).toBeNull();
  });
});

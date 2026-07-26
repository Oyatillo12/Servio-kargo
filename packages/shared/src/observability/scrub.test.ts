import { describe, expect, it } from 'vitest';

import { REDACTED, scrubText, scrubValue } from './scrub';

describe('scrubText', () => {
  it('redacts a Telegram bot token', () => {
    const out = scrubText(
      'setWebhook failed for 8872793732:AAEp7wq-ayj5nT_uinYQovAjETp2QoLfw1o',
    );
    expect(out).toContain(REDACTED.token);
    expect(out).not.toContain('AAEp7wq');
  });

  it('redacts credentials in a postgres connection string', () => {
    const out = scrubText(
      'connect ECONNREFUSED postgres://kargotrack:s3cr3t-pass@postgres:5432/kargotrack',
    );
    expect(out).not.toContain('s3cr3t-pass');
    expect(out).toContain(REDACTED.url);
    // The non-secret part still identifies the failure.
    expect(out).toContain('postgres:5432/kargotrack');
  });

  it('redacts uzbek phone numbers in every common shape', () => {
    for (const phone of [
      '+998901234567',
      '998901234567',
      '+998 90 123 45 67',
      '+998(90)123-45-67',
    ]) {
      expect(scrubText(`customer ${phone} not found`)).toBe(
        `customer ${REDACTED.phone} not found`,
      );
    }
  });

  it('redacts track codes but leaves ordinary words alone', () => {
    expect(scrubText('duplicate key YT1000000001')).toBe(
      `duplicate key ${REDACTED.code}`,
    );
    // No digits → not a track code, keep it readable.
    expect(scrubText('CONSTRAINT VIOLATION')).toBe('CONSTRAINT VIOLATION');
    // Too short to be a valid code (SPEC §7.1 needs 8+).
    expect(scrubText('ERR 12345')).toBe('ERR 12345');
  });

  it('redacts key=value secrets whatever the separator', () => {
    expect(scrubText('SESSION_SECRET=abc123xyz')).not.toContain('abc123xyz');
    expect(scrubText('{"token": "abc123xyz"}')).not.toContain('abc123xyz');
    expect(scrubText('password: hunter2')).not.toContain('hunter2');
  });

  it('leaves an ordinary message untouched', () => {
    const msg = 'failed to start notification worker';
    expect(scrubText(msg)).toBe(msg);
  });
});

describe('scrubValue', () => {
  it('drops denied keys regardless of their value', () => {
    const out = scrubValue({
      phone: '+998901234567',
      full_name: 'Aziz Karimov',
      bot_token: 'anything',
      tenantId: 'ok-to-keep',
    }) as Record<string, unknown>;

    expect(out.phone).toBe(REDACTED.secret);
    expect(out.full_name).toBe(REDACTED.secret);
    expect(out.bot_token).toBe(REDACTED.secret);
    expect(out.tenantId).toBe('ok-to-keep');
  });

  it('scrubs nested strings inside arrays and objects', () => {
    const out = scrubValue({
      level: 'error',
      params: ['YT1000000001', { note: 'call +998901234567' }],
    }) as { params: [string, { note: string }] };

    expect(out.params[0]).toBe(REDACTED.code);
    expect(out.params[1].note).toBe(`call ${REDACTED.phone}`);
  });

  it('survives circular references', () => {
    const a: Record<string, unknown> = { name: 'a' };
    a.self = a;
    expect(() => scrubValue(a)).not.toThrow();
    expect((scrubValue(a) as Record<string, unknown>).self).toBe('[circular]');
  });

  it('truncates past the depth cap instead of recursing forever', () => {
    let deep: Record<string, unknown> = { end: 'YT1000000001' };
    for (let i = 0; i < 20; i += 1) deep = { nested: deep };
    expect(() => scrubValue(deep)).not.toThrow();
    expect(JSON.stringify(scrubValue(deep))).toContain('[truncated]');
  });

  it('passes primitives through unchanged', () => {
    expect(scrubValue(42)).toBe(42);
    expect(scrubValue(true)).toBe(true);
    expect(scrubValue(null)).toBe(null);
    expect(scrubValue(undefined)).toBe(undefined);
  });
});

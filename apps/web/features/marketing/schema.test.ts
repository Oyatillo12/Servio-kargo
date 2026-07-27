import { describe, expect, it } from 'vitest';

import { leadSchema, MIN_FILL_TIME_MS } from './schema';

const valid = {
  name: 'Aziz',
  phone: '+998 90 123 45 67',
  company: '',
  locale: 'uz',
  website: '',
  startedAt: '1700000000000',
};

describe('leadSchema', () => {
  it('accepts a normal submission and keeps the phone as typed', () => {
    const parsed = leadSchema.parse(valid);
    expect(parsed.name).toBe('Aziz');
    expect(parsed.phone).toBe('+998 90 123 45 67');
    expect(parsed.company).toBeNull();
    expect(parsed.locale).toBe('uz');
    expect(parsed.startedAt).toBe(1_700_000_000_000);
  });

  it('trims name/company and turns an empty company into null', () => {
    const parsed = leadSchema.parse({
      ...valid,
      name: '  Umid  ',
      company: '  Karvon Cargo ',
    });
    expect(parsed.name).toBe('Umid');
    expect(parsed.company).toBe('Karvon Cargo');
    expect(leadSchema.parse({ ...valid, company: '   ' }).company).toBeNull();
  });

  it('rejects too-short names', () => {
    expect(leadSchema.safeParse({ ...valid, name: 'A' }).success).toBe(false);
  });

  it('accepts local phone formats but rejects non-numbers', () => {
    expect(
      leadSchema.safeParse({ ...valid, phone: '90 123-45-67' }).success,
    ).toBe(true);
    expect(leadSchema.safeParse({ ...valid, phone: 'yo, call me' }).success).toBe(
      false,
    );
    expect(leadSchema.safeParse({ ...valid, phone: '12345' }).success).toBe(
      false,
    );
  });

  it('rejects a filled honeypot', () => {
    const res = leadSchema.safeParse({ ...valid, website: 'https://spam.io' });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0]?.path[0]).toBe('website');
    }
  });

  it('falls back to uz on an unknown locale instead of failing', () => {
    expect(leadSchema.parse({ ...valid, locale: 'xx' }).locale).toBe('uz');
  });

  it('rejects a missing startedAt (non-JS bot posting raw)', () => {
    expect(leadSchema.safeParse({ ...valid, startedAt: null }).success).toBe(
      false,
    );
    expect(leadSchema.safeParse({ ...valid, startedAt: '' }).success).toBe(
      false,
    );
  });

  it('exports a sane minimum fill time', () => {
    expect(MIN_FILL_TIME_MS).toBeGreaterThanOrEqual(1_000);
  });
});

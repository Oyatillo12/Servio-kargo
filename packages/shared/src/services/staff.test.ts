import { describe, expect, it } from 'vitest';

import { parseStaffWeighing, planStaffWeighing } from './staff';

describe('parseStaffWeighing', () => {
  it('parses a code + dot decimal kg', () => {
    expect(parseStaffWeighing('ABC12345 3.2')).toEqual({
      codeNormalized: 'ABC12345',
      codeOriginal: 'ABC12345',
      weightGrams: 3200,
      marka: null,
    });
  });

  it('accepts a comma decimal', () => {
    expect(parseStaffWeighing('ABC12345 3,2')?.weightGrams).toBe(3200);
  });

  it('accepts a whole number', () => {
    expect(parseStaffWeighing('ABC12345 3')?.weightGrams).toBe(3000);
  });

  it('tolerates extra inner whitespace', () => {
    expect(parseStaffWeighing('  ABC12345   2.5  ')).toEqual({
      codeNormalized: 'ABC12345',
      codeOriginal: 'ABC12345',
      weightGrams: 2500,
      marka: null,
    });
  });

  it('normalizes a lowercase/dashed code but keeps the original for display', () => {
    expect(parseStaffWeighing('ab-123-456 1')).toEqual({
      codeNormalized: 'AB123456',
      codeOriginal: 'ab-123-456',
      weightGrams: 1000,
      marka: null,
    });
  });

  it('rejects a single token (a bare lookup code)', () => {
    expect(parseStaffWeighing('ABC12345')).toBeNull();
  });

  it('rejects a non-numeric or unit-suffixed weight', () => {
    expect(parseStaffWeighing('ABC12345 heavy')).toBeNull();
    expect(parseStaffWeighing('ABC12345 3kg')).toBeNull();
  });

  it('rejects a too-short code', () => {
    expect(parseStaffWeighing('ABC12 3.2')).toBeNull();
  });

  it('rejects empty / whitespace', () => {
    expect(parseStaffWeighing('')).toBeNull();
    expect(parseStaffWeighing('   ')).toBeNull();
  });
});

describe('parseStaffWeighing — the marka (tasks.md W5)', () => {
  it('reads a third token as the marka, exactly as typed', () => {
    // Kept raw: matching it to a customer is the query layer's job, and it is
    // echoed back to the operator when nothing answers to it.
    expect(parseStaffWeighing('ABC12345 3.2 dk-1042')).toEqual({
      codeNormalized: 'ABC12345',
      codeOriginal: 'ABC12345',
      weightGrams: 3200,
      marka: 'dk-1042',
    });
  });

  it('does NOT read a trailing unit as a marka', () => {
    // A client_code always carries a digit, which is the whole rule keeping
    // `3.2 kg` from meaning "3.2 kg for the customer named kg" — in any
    // language, without a deny-list of unit words.
    expect(parseStaffWeighing('ABC12345 3.2 kg')).toBeNull();
    expect(parseStaffWeighing('ABC12345 3.2 кг')).toBeNull();
  });

  it('accepts a marka that matches nobody — that is not a parse error', () => {
    expect(parseStaffWeighing('ABC12345 3.2 ZZ-9999')?.marka).toBe('ZZ-9999');
  });

  it('rejects a fourth token — past three this is prose, not a command', () => {
    expect(parseStaffWeighing('ABC12345 3.2 DK-1042 keldi')).toBeNull();
  });

  it('rejects an absurdly long marka rather than looking it up', () => {
    expect(parseStaffWeighing(`ABC12345 3.2 DK-${'9'.repeat(40)}`)).toBeNull();
  });
});

describe('planStaffWeighing', () => {
  it('advances a CREATED track with a customer: event + notify', () => {
    expect(
      planStaffWeighing({ currentStatus: 'CREATED', customerId: 'c1' }),
    ).toEqual({ newStatus: 'CHINA_WAREHOUSE', willEvent: true, willNotify: true });
  });

  it('advances a CREATED track without a customer: event, no notify', () => {
    expect(
      planStaffWeighing({ currentStatus: 'CREATED', customerId: null }),
    ).toEqual({
      newStatus: 'CHINA_WAREHOUSE',
      willEvent: true,
      willNotify: false,
    });
  });

  it('leaves an already-CHINA_WAREHOUSE track unchanged (no transition)', () => {
    expect(
      planStaffWeighing({ currentStatus: 'CHINA_WAREHOUSE', customerId: 'c1' }),
    ).toEqual({
      newStatus: 'CHINA_WAREHOUSE',
      willEvent: false,
      willNotify: false,
    });
  });

  it('does not move a track already further down the pipeline', () => {
    expect(
      planStaffWeighing({ currentStatus: 'IN_TRANSIT', customerId: 'c1' }),
    ).toEqual({ newStatus: 'IN_TRANSIT', willEvent: false, willNotify: false });
  });
});

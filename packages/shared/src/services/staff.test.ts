import { describe, expect, it } from 'vitest';

import { parseStaffWeighing, planStaffWeighing } from './staff';

describe('parseStaffWeighing', () => {
  it('parses a code + dot decimal kg', () => {
    expect(parseStaffWeighing('ABC12345 3.2')).toEqual({
      codeNormalized: 'ABC12345',
      codeOriginal: 'ABC12345',
      weightGrams: 3200,
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
    });
  });

  it('normalizes a lowercase/dashed code but keeps the original for display', () => {
    expect(parseStaffWeighing('ab-123-456 1')).toEqual({
      codeNormalized: 'AB123456',
      codeOriginal: 'ab-123-456',
      weightGrams: 1000,
    });
  });

  it('rejects a single token (a bare lookup code)', () => {
    expect(parseStaffWeighing('ABC12345')).toBeNull();
  });

  it('rejects a non-numeric or unit-suffixed weight', () => {
    expect(parseStaffWeighing('ABC12345 heavy')).toBeNull();
    expect(parseStaffWeighing('ABC12345 3kg')).toBeNull();
    expect(parseStaffWeighing('ABC12345 3.2 kg')).toBeNull();
  });

  it('rejects a too-short code', () => {
    expect(parseStaffWeighing('ABC12 3.2')).toBeNull();
  });

  it('rejects empty / whitespace', () => {
    expect(parseStaffWeighing('')).toBeNull();
    expect(parseStaffWeighing('   ')).toBeNull();
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

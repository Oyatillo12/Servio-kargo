import { describe, expect, it } from 'vitest';

import { looksLikeClientCode, nextClientCode } from './clientCode';

describe('nextClientCode', () => {
  it('starts at prefix-1001 when there are no existing codes', () => {
    expect(nextClientCode('DK', [])).toBe('DK-1001');
  });

  it('returns max trailing number + 1', () => {
    expect(nextClientCode('DK', ['DK-1001', 'DK-1002', 'DK-1005'])).toBe(
      'DK-1006',
    );
  });

  it('is robust to unsorted input and gaps', () => {
    expect(nextClientCode('DK', ['DK-1004', 'DK-1001', 'DK-1003'])).toBe(
      'DK-1005',
    );
  });

  it('honors the tenant prefix', () => {
    expect(nextClientCode('YWU', ['YWU-1010'])).toBe('YWU-1011');
  });

  it('ignores codes without a trailing number', () => {
    expect(nextClientCode('DK', ['DK-', 'weird'])).toBe('DK-1001');
  });
});

describe('looksLikeClientCode (SPEC §3.14, §5.14 — L2)', () => {
  it('recognises the shape a client card carries', () => {
    expect(looksLikeClientCode('DK-1042')).toBe(true);
    expect(looksLikeClientCode('dk-1042')).toBe(true);
    expect(looksLikeClientCode('DK1042')).toBe(true);
    expect(looksLikeClientCode(' DK-1042 ')).toBe(true);
    expect(looksLikeClientCode('ABCD-1')).toBe(true);
  });

  it('leaves a track code to the track path', () => {
    // §7.1 codes are long and mix digits with letters throughout; misreading
    // one as a marka would attribute a parcel to a customer who does not exist.
    expect(looksLikeClientCode('YT7563290731168')).toBe(false);
    expect(looksLikeClientCode('SF1400937821AB')).toBe(false);
    expect(looksLikeClientCode('1234567890')).toBe(false);
    expect(looksLikeClientCode('')).toBe(false);
    expect(looksLikeClientCode('DK-')).toBe(false);
    expect(looksLikeClientCode('TOOLONGPREFIX-12')).toBe(false);
  });
});

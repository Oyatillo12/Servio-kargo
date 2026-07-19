import { describe, expect, it } from 'vitest';

import { nextClientCode } from './clientCode';

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

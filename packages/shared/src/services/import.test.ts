import { describe, expect, it } from 'vitest';

import {
  classifyImportCandidates,
  parseImportText,
  splitAgainstExisting,
} from './import';

describe('parseImportText (SPEC §5.4)', () => {
  it('splits on newlines, commas and semicolons but not interior spaces', () => {
    const lines = parseImportText('yt-7583 234 uz\nSF12345678, JD87654321; CN11112222');
    expect(lines).toEqual([
      'yt-7583 234 uz',
      'SF12345678',
      'JD87654321',
      'CN11112222',
    ]);
  });

  it('drops blank lines', () => {
    expect(parseImportText('\n\n  \nAB12345678\n')).toEqual(['AB12345678']);
  });
});

describe('classifyImportCandidates (messy inputs, §7.1)', () => {
  it('normalizes and keeps 8–20 char alphanumeric codes', () => {
    const r = classifyImportCandidates([' yt-7583 234 uz ']);
    expect(r.valid).toEqual([{ original: 'yt-7583 234 uz', normalized: 'YT7583234UZ' }]);
    expect(r.malformed).toEqual([]);
  });

  it('strips CJK and other non-alnum before validating', () => {
    const r = classifyImportCandidates(['订单775123456789']);
    expect(r.valid).toEqual([
      { original: '订单775123456789', normalized: '775123456789' },
    ]);
  });

  it('flags too-short normalized codes as malformed', () => {
    const r = classifyImportCandidates(['SF123', 'ok', '   ']);
    expect(r.malformed).toEqual(['SF123', 'ok']);
    expect(r.valid).toEqual([]);
  });

  it('flags too-long (>20) normalized codes as malformed', () => {
    const long = 'A'.repeat(21);
    const r = classifyImportCandidates([long]);
    expect(r.malformed).toEqual([long]);
  });

  it('de-duplicates within the batch by normalized code (first original wins)', () => {
    const r = classifyImportCandidates([
      'yt-7583234uz',
      'YT 7583 234 UZ',
      'yt7583234uz',
    ]);
    expect(r.valid).toEqual([
      { original: 'yt-7583234uz', normalized: 'YT7583234UZ' },
    ]);
    expect(r.duplicateCount).toBe(2);
  });

  it('handles a realistic messy paste', () => {
    const text = [
      'YT1000000001',
      '  yt-1000000002  ',
      'yo\'q', // normalizes to "YOQ" (3) → malformed
      'SF9', // too short
      'JD1000000003, CN1000000004',
      '',
      'YT1000000001', // dupe
    ].join('\n');
    const r = classifyImportCandidates(parseImportText(text));
    expect(r.valid.map((c) => c.normalized)).toEqual([
      'YT1000000001',
      'YT1000000002',
      'JD1000000003',
      'CN1000000004',
    ]);
    expect(r.malformed).toEqual(["yo'q", 'SF9']);
    expect(r.duplicateCount).toBe(1);
  });
});

describe('splitAgainstExisting (§7.2)', () => {
  it('separates new codes from ones already in the DB', () => {
    const codes = [
      { original: 'A', normalized: 'AAAA1111' },
      { original: 'B', normalized: 'BBBB2222' },
      { original: 'C', normalized: 'CCCC3333' },
    ];
    const existing = new Set(['BBBB2222']);
    const split = splitAgainstExisting(codes, existing);
    expect(split.toCreate.map((c) => c.normalized)).toEqual(['AAAA1111', 'CCCC3333']);
    expect(split.toUpdate.map((c) => c.normalized)).toEqual(['BBBB2222']);
  });
});

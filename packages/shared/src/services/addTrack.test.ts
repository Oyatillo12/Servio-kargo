import { describe, expect, it } from 'vitest';

import { uz } from '../i18n';
import {
  buildAddSummary,
  classifyCandidate,
  emptyAddGroups,
  parseCodeCandidates,
} from './addTrack';

describe('parseCodeCandidates', () => {
  it('splits on newlines, commas and semicolons', () => {
    expect(
      parseCodeCandidates('AB12345678\nCD87654321,EF11112222;GH33334444'),
    ).toEqual(['AB12345678', 'CD87654321', 'EF11112222', 'GH33334444']);
  });

  it('keeps interior spaces so one spaced code stays one candidate (§7.1)', () => {
    // "yt-7583 234 uz" is a SINGLE code; normalization strips the spaces later.
    expect(parseCodeCandidates('yt-7583 234 uz')).toEqual(['yt-7583 234 uz']);
  });

  it('trims and drops blank lines', () => {
    expect(parseCodeCandidates('  AB12345678 \n\n , ; \n CD87654321 ')).toEqual(
      ['AB12345678', 'CD87654321'],
    );
  });
});

describe('classifyCandidate (§3.2 / §7.3)', () => {
  const me = 'cust-1';

  it('bad_format for a too-short normalized code', () => {
    expect(
      classifyCandidate({
        normalized: 'SF123',
        existing: null,
        requestingCustomerId: me,
      }),
    ).toBe('bad_format');
  });

  it('added when no track exists', () => {
    expect(
      classifyCandidate({
        normalized: 'AB12345678',
        existing: null,
        requestingCustomerId: me,
      }),
    ).toBe('added');
  });

  it('claimed when the existing track is unattached', () => {
    expect(
      classifyCandidate({
        normalized: 'AB12345678',
        existing: { customerId: null },
        requestingCustomerId: me,
      }),
    ).toBe('claimed');
  });

  it('already when attached to the requesting customer', () => {
    expect(
      classifyCandidate({
        normalized: 'AB12345678',
        existing: { customerId: me },
        requestingCustomerId: me,
      }),
    ).toBe('already');
  });

  it('other_owner when attached to a different customer', () => {
    expect(
      classifyCandidate({
        normalized: 'AB12345678',
        existing: { customerId: 'cust-2' },
        requestingCustomerId: me,
      }),
    ).toBe('other_owner');
  });
});

describe('buildAddSummary (§4.3)', () => {
  it('renders only non-empty groups', () => {
    const g = emptyAddGroups();
    g.added.push('AB12345678', 'CD87654321');
    g.badFormat.push('SF123');
    const msg = buildAddSummary(g, uz);
    expect(msg).toContain("✅ Qo'shildi (2): AB12345678, CD87654321");
    expect(msg).toContain("❌ Noto'g'ri format (1): SF123");
    expect(msg).not.toContain('biriktirildi');
    expect(msg).not.toContain('tegishli');
  });

  it('renders claimed and other-owner groups', () => {
    const g = emptyAddGroups();
    g.claimed.push('AB12345678');
    g.otherOwner.push('CD87654321');
    const msg = buildAddSummary(g, uz);
    expect(msg).toContain('♻️ Sizga biriktirildi (1): AB12345678');
    expect(msg).toContain('⛔ Boshqa mijozga tegishli (1): CD87654321');
  });

  it('falls back to "nothing new" when every group is empty', () => {
    expect(buildAddSummary(emptyAddGroups(), uz)).toBe(uz.addNothingNew);
  });
});

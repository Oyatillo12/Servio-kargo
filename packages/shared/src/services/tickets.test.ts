import { describe, expect, it } from 'vitest';

import {
  TICKET_CATEGORIES,
  TICKET_CATEGORY_META,
  TICKET_STATUSES,
  TICKET_STATUS_META,
  TICKET_TEXT_MAX,
  clampTicketText,
  ticketStatusAfterMessage,
} from './tickets';

describe('ticket catalogue (rule 5)', () => {
  it('labels every category and status in both languages', () => {
    for (const c of TICKET_CATEGORIES) {
      expect(TICKET_CATEGORY_META[c].uz).toBeTruthy();
      expect(TICKET_CATEGORY_META[c].ru).toBeTruthy();
    }
    for (const s of TICKET_STATUSES) {
      expect(TICKET_STATUS_META[s].uz).toBeTruthy();
      expect(TICKET_STATUS_META[s].ru).toBeTruthy();
    }
  });
});

describe('clampTicketText (§7.15)', () => {
  it('trims and keeps ordinary text', () => {
    expect(clampTicketText('  Qutim ochilgan keldi  ')).toBe(
      'Qutim ochilgan keldi',
    );
  });

  it('truncates over the cap instead of refusing', () => {
    const long = 'x'.repeat(TICKET_TEXT_MAX + 500);
    expect(clampTicketText(long)).toHaveLength(TICKET_TEXT_MAX);
  });

  it('returns null for blank input', () => {
    expect(clampTicketText('   ')).toBeNull();
  });
});

describe('ticketStatusAfterMessage (D-006 reopen rule)', () => {
  it('reopens a closed ticket on a customer message', () => {
    expect(ticketStatusAfterMessage('closed', 'customer')).toBe('open');
  });

  it('leaves open/in_progress alone', () => {
    expect(ticketStatusAfterMessage('open', 'customer')).toBe('open');
    expect(ticketStatusAfterMessage('in_progress', 'customer')).toBe(
      'in_progress',
    );
  });

  it('never moves status on a staff message', () => {
    expect(ticketStatusAfterMessage('closed', 'staff')).toBe('closed');
  });
});

import { describe, expect, it } from 'vitest';

import {
  isAssignEventMeta,
  planAssignCustomer,
  type AssignCustomerPlan,
} from './assignCustomer';

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';

function plan(
  currentCustomerId: string | null,
  newCustomerId: string | null,
): AssignCustomerPlan {
  return planAssignCustomer({ currentCustomerId, newCustomerId });
}

describe('planAssignCustomer', () => {
  it('attaches an unclaimed track (§7.3 — the day-0 import case)', () => {
    const p = plan(null, A);
    expect(p.action).toBe('attach');
    expect(p.willWrite).toBe(true);
    expect(p.willEvent).toBe(true);
    expect(p.eventMeta).toEqual({
      action: 'attach',
      fromCustomerId: null,
      toCustomerId: A,
    });
  });

  it('detaches an owned track', () => {
    const p = plan(A, null);
    expect(p.action).toBe('detach');
    expect(p.willWrite).toBe(true);
    expect(p.eventMeta).toEqual({
      action: 'detach',
      fromCustomerId: A,
      toCustomerId: null,
    });
  });

  it('reassigns when the wrong customer claimed the code (§7.3 correction)', () => {
    const p = plan(A, B);
    expect(p.action).toBe('reassign');
    expect(p.willWrite).toBe(true);
    expect(p.eventMeta).toEqual({
      action: 'reassign',
      fromCustomerId: A,
      toCustomerId: B,
    });
  });

  it('is a no-op when the owner is unchanged — no write, no audit row', () => {
    for (const p of [plan(A, A), plan(null, null)]) {
      expect(p.action).toBe('noop');
      expect(p.willWrite).toBe(false);
      expect(p.willEvent).toBe(false);
      expect(p.eventMeta).toBeNull();
    }
  });

  it('re-attaching after a detach is a fresh attach, not a resurrection', () => {
    expect(plan(A, null).action).toBe('detach');
    expect(plan(null, A).action).toBe('attach');
    expect(plan(null, B).action).toBe('attach');
  });

  it('always writes an audit row whenever it writes the row (rule 7)', () => {
    for (const p of [plan(null, A), plan(A, null), plan(A, B)]) {
      expect(p.willEvent).toBe(p.willWrite);
      expect(p.eventMeta).not.toBeNull();
    }
  });
});

describe('isAssignEventMeta', () => {
  it('recognises assignment events', () => {
    expect(isAssignEventMeta(planAssignCustomer({
      currentCustomerId: null,
      newCustomerId: A,
    }).eventMeta)).toBe(true);
    expect(isAssignEventMeta({ action: 'reassign' })).toBe(true);
  });

  it('rejects status-change events and junk', () => {
    expect(isAssignEventMeta({ source: 'import' })).toBe(false);
    expect(isAssignEventMeta({ source: 'panel' })).toBe(false);
    expect(isAssignEventMeta({ action: 'noop' })).toBe(false);
    expect(isAssignEventMeta(null)).toBe(false);
    expect(isAssignEventMeta(undefined)).toBe(false);
    expect(isAssignEventMeta('attach')).toBe(false);
  });
});

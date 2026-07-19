import { describe, expect, it } from 'vitest';

import { planStatusChange } from './statusChange';

describe('planStatusChange', () => {
  const CUST = 'cust-1';

  it('no-ops a same-status write on a live, attached track', () => {
    expect(
      planStatusChange({
        previousStatus: 'IN_TRANSIT',
        newStatus: 'IN_TRANSIT',
        customerId: CUST,
        wasDeleted: false,
      }),
    ).toEqual({ willWrite: false, willEvent: false, willNotify: false });
  });

  it('writes, events and notifies on a real change for an attached track', () => {
    expect(
      planStatusChange({
        previousStatus: 'CHINA_WAREHOUSE',
        newStatus: 'IN_TRANSIT',
        customerId: CUST,
        wasDeleted: false,
      }),
    ).toEqual({ willWrite: true, willEvent: true, willNotify: true });
  });

  it('does not notify a change on an unclaimed track, but still writes + events', () => {
    expect(
      planStatusChange({
        previousStatus: 'CHINA_WAREHOUSE',
        newStatus: 'IN_TRANSIT',
        customerId: null,
        wasDeleted: false,
      }),
    ).toEqual({ willWrite: true, willEvent: true, willNotify: false });
  });

  it('never notifies when moving into CREATED (no §4.2 template)', () => {
    expect(
      planStatusChange({
        previousStatus: 'CHINA_WAREHOUSE',
        newStatus: 'CREATED',
        customerId: CUST,
        wasDeleted: false,
      }),
    ).toMatchObject({ willWrite: true, willEvent: true, willNotify: false });
  });

  it('revives a soft-deleted row even when the status is unchanged (no event/notify)', () => {
    expect(
      planStatusChange({
        previousStatus: 'IN_TRANSIT',
        newStatus: 'IN_TRANSIT',
        customerId: CUST,
        wasDeleted: true,
      }),
    ).toEqual({ willWrite: true, willEvent: false, willNotify: false });
  });

  it('notifies backward status corrections too (mistake fixes, §7.2)', () => {
    expect(
      planStatusChange({
        previousStatus: 'READY_FOR_PICKUP',
        newStatus: 'IN_TRANSIT',
        customerId: CUST,
        wasDeleted: false,
      }),
    ).toMatchObject({ willEvent: true, willNotify: true });
  });
});

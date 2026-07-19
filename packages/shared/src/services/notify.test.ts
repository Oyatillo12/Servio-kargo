import { describe, expect, it } from 'vitest';

import {
  isNotifiableStatus,
  notifyDedupeKey,
  shouldEnqueueNotification,
  type StatusChangeInput,
} from './notify';

const input = (over: Partial<StatusChangeInput>): StatusChangeInput => ({
  previousStatus: 'CREATED',
  newStatus: 'TASHKENT_WAREHOUSE',
  customerId: 'cust-1',
  ...over,
});

describe('shouldEnqueueNotification (SPEC §4.2, §2)', () => {
  it('enqueues on a real status change for an attached customer', () => {
    expect(shouldEnqueueNotification(input({}))).toBe(true);
  });

  it('enqueues for a newly created track (previousStatus null) when notifiable', () => {
    expect(
      shouldEnqueueNotification(
        input({ previousStatus: null, newStatus: 'CHINA_WAREHOUSE' }),
      ),
    ).toBe(true);
  });

  it('does not enqueue when no customer is attached', () => {
    expect(shouldEnqueueNotification(input({ customerId: null }))).toBe(false);
  });

  it('does not enqueue when the status is unchanged (no-op write)', () => {
    expect(
      shouldEnqueueNotification(
        input({ previousStatus: 'IN_TRANSIT', newStatus: 'IN_TRANSIT' }),
      ),
    ).toBe(false);
  });

  it('does not enqueue for CREATED (no §4.2 template)', () => {
    expect(
      shouldEnqueueNotification(
        input({ previousStatus: null, newStatus: 'CREATED' }),
      ),
    ).toBe(false);
  });

  it('enqueues for terminal side-states (LOST/RETURNED)', () => {
    expect(
      shouldEnqueueNotification(input({ newStatus: 'LOST' })),
    ).toBe(true);
    expect(
      shouldEnqueueNotification(input({ newStatus: 'RETURNED' })),
    ).toBe(true);
  });
});

describe('isNotifiableStatus', () => {
  it('is false only for CREATED', () => {
    expect(isNotifiableStatus('CREATED')).toBe(false);
    expect(isNotifiableStatus('DELIVERED')).toBe(true);
    expect(isNotifiableStatus('READY_FOR_PICKUP')).toBe(true);
  });
});

describe('notifyDedupeKey (§7.6)', () => {
  it('combines track id and status', () => {
    expect(notifyDedupeKey('trk-9', 'DELIVERED')).toBe('trk-9:DELIVERED');
  });
});

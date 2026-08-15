import { describe, expect, it } from 'vitest';

import {
  ADMIN_ROLES,
  CAPABILITIES,
  ROLE_CAPABILITIES,
  can,
  canAll,
  canSignIn,
  canUseStaffMode,
  toAdminRole,
  type Capability,
} from './permissions';

describe('toAdminRole', () => {
  it.each(ADMIN_ROLES)('passes %s through', (role) => {
    expect(toAdminRole(role)).toBe(role);
  });

  it('reads the retired `staff` value as manager', () => {
    // Everyone who held it was doing office work; the migration rewrites the
    // rows, but a replica mid-deploy can still hand us the old value.
    expect(toAdminRole('staff')).toBe('manager');
  });

  it('falls back to the LEAST privileged role for anything unknown', () => {
    // The whole point: a role we cannot read must never mean "allow".
    for (const value of ['admin', 'OWNER', '', null, undefined]) {
      expect(toAdminRole(value)).toBe('warehouse');
    }
  });
});

describe('ROLE_CAPABILITIES', () => {
  it('lets the owner do everything', () => {
    for (const capability of CAPABILITIES) {
      expect(can('owner', capability)).toBe(true);
    }
  });

  it('grants only capabilities that exist', () => {
    const known = new Set<string>(CAPABILITIES);
    for (const role of ADMIN_ROLES) {
      for (const capability of ROLE_CAPABILITIES[role]) {
        expect(known.has(capability)).toBe(true);
      }
    }
  });

  it('lists no capability twice within a role', () => {
    for (const role of ADMIN_ROLES) {
      const granted = ROLE_CAPABILITIES[role];
      expect(new Set(granted).size).toBe(granted.length);
    }
  });

  it('never grants a lower role something a higher role lacks', () => {
    // manager ⊆ owner and warehouse ⊆ manager. If this ever fails, the matrix
    // has stopped describing a hierarchy and every guard has to be re-read.
    for (const capability of ROLE_CAPABILITIES.manager) {
      expect(can('owner', capability)).toBe(true);
    }
    for (const capability of ROLE_CAPABILITIES.warehouse) {
      expect(can('manager', capability)).toBe(true);
    }
  });
});

describe('can — the boundaries that motivated T8', () => {
  const OWNER_ONLY: Capability[] = [
    'settings.manage', // currency + tariffs reprice every future track
    'team.manage',
    'broadcast.send', // one press reaches every customer
    'tracks.delete',
  ];

  it.each(OWNER_ONLY)('%s is owner-only', (capability) => {
    expect(can('owner', capability)).toBe(true);
    expect(can('manager', capability)).toBe(false);
    expect(can('warehouse', capability)).toBe(false);
  });

  it('keeps a warehouse hand away from money and customer records', () => {
    expect(can('warehouse', 'money.reports')).toBe(false);
    expect(can('warehouse', 'payments.record')).toBe(false);
    expect(can('warehouse', 'payments.cancel')).toBe(false);
    expect(can('warehouse', 'customers.manage')).toBe(false);
    expect(can('warehouse', 'export.data')).toBe(false);
    expect(can('warehouse', 'import.run')).toBe(false);
  });

  it('still lets a warehouse hand see ONE customer balance at handover', () => {
    // Releasing a parcel without knowing whether it is paid for is how the
    // company loses the money the panel exists to track.
    expect(can('warehouse', 'money.customerDebt')).toBe(true);
    expect(can('warehouse', 'customers.view')).toBe(true);
  });

  it('lets a warehouse hand do the warehouse job', () => {
    expect(can('warehouse', 'tracks.weigh')).toBe(true);
    expect(can('warehouse', 'tracks.status')).toBe(true);
    expect(can('warehouse', 'tracks.view')).toBe(true);
  });

  it('keeps the ticket desk in the office (H3, §5.16)', () => {
    expect(can('owner', 'tickets.handle')).toBe(true);
    expect(can('manager', 'tickets.handle')).toBe(true);
    expect(can('warehouse', 'tickets.handle')).toBe(false);
  });

  it('keeps track-metadata editing in the office (H1, §7.13)', () => {
    // The warehouse writes the marka through the weighing flow; re-editing
    // evidence from the track page is office work.
    expect(can('owner', 'tracks.edit')).toBe(true);
    expect(can('manager', 'tracks.edit')).toBe(true);
    expect(can('warehouse', 'tracks.edit')).toBe(false);
  });

  it('lets a warehouse hand attribute a parcel at intake', () => {
    // The marka is read off the box by the person holding it (tasks.md W2);
    // weighing without being able to say whose it is leaves the job half done.
    expect(can('warehouse', 'tracks.assign')).toBe(true);
  });

  it('lets a manager run the daily operation', () => {
    expect(can('manager', 'import.run')).toBe(true);
    expect(can('manager', 'payments.record')).toBe(true);
    // Storno stays with whoever records (2026-08-15, owner's call): the audit
    // trail — reason, canceler, dashboard cash-by-staff — is the control.
    expect(can('manager', 'payments.cancel')).toBe(true);
    expect(can('manager', 'tracks.assign')).toBe(true);
    expect(can('manager', 'batches.manage')).toBe(true);
    expect(can('manager', 'money.reports')).toBe(true);
  });

  it('separates chasing one debtor from broadcasting to everyone', () => {
    expect(can('manager', 'reminders.send')).toBe(true);
    expect(can('manager', 'broadcast.send')).toBe(false);
  });

  it('denies everything for an unreadable role', () => {
    // Falls back to warehouse, so the dangerous half is closed.
    expect(can(null, 'settings.manage')).toBe(false);
    expect(can(undefined, 'payments.record')).toBe(false);
    expect(can('superuser', 'team.manage')).toBe(false);
  });
});

describe('canAll', () => {
  it('requires every capability', () => {
    expect(canAll('manager', ['tracks.view', 'payments.record'])).toBe(true);
    expect(canAll('manager', ['tracks.view', 'settings.manage'])).toBe(false);
  });

  it('is true for an empty list', () => {
    expect(canAll('warehouse', [])).toBe(true);
  });
});

describe('canSignIn', () => {
  const panelUser = {
    phone: '+998901234567',
    passwordHash: '$argon2id$v=19$...',
    active: true,
  };

  it('accepts an active employee with phone and password', () => {
    expect(canSignIn(panelUser)).toBe(true);
  });

  it('refuses a deactivated employee', () => {
    expect(canSignIn({ ...panelUser, active: false })).toBe(false);
  });

  it('refuses bot-only staff, who have neither', () => {
    // The state every id migrated out of settings.staff_tg_ids landed in.
    expect(canSignIn({ phone: null, passwordHash: null, active: true })).toBe(
      false,
    );
  });

  it('refuses an invited employee who has not set a password yet', () => {
    expect(canSignIn({ ...panelUser, passwordHash: null })).toBe(false);
  });
});

describe('canUseStaffMode', () => {
  it('accepts every role, once Telegram is linked', () => {
    for (const role of ADMIN_ROLES) {
      expect(canUseStaffMode({ tgUserId: 123, active: true, role })).toBe(true);
    }
  });

  it('refuses an unlinked account', () => {
    expect(
      canUseStaffMode({ tgUserId: null, active: true, role: 'warehouse' }),
    ).toBe(false);
  });

  it('refuses a deactivated employee — this is how bot access is revoked', () => {
    expect(
      canUseStaffMode({ tgUserId: 123, active: false, role: 'owner' }),
    ).toBe(false);
  });
});

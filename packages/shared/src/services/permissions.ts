/**
 * Who may do what (SPEC §1, AUDIT.md T8).
 *
 * The `role` column existed from day one but was read in exactly one place — a
 * label in the account menu — so every signed-in employee could change the
 * tenant's currency, rewrite tariffs, broadcast to every customer and delete
 * tracks. This module is the single answer to "may they?", used by the panel's
 * server actions AND by the bot's staff mode, so the two surfaces can never
 * drift into disagreeing about the same person.
 *
 * Framework-free and data-free on purpose: it takes a role and a capability and
 * returns a boolean. Anything that needs a database or a session lives in the
 * apps.
 */

/** Roles in descending authority. Matches the `admin_role` enum minus `staff`. */
export const ADMIN_ROLES = ['owner', 'manager', 'warehouse'] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

/**
 * Things an employee can attempt. Named after the ACT, not the screen, so a
 * capability keeps its meaning when the UI moves — `money.reports` is the same
 * permission whether it is asked for by /debtors, the dashboard or an export.
 */
export const CAPABILITIES = [
  /** See the track list and a track's detail. */
  'tracks.view',
  /** Move tracks through the pipeline (single or bulk). */
  'tracks.status',
  /** Set weight → price, from the panel or by weighing in the bot. */
  'tracks.weigh',
  /** Attach/detach a customer or a batch. */
  'tracks.assign',
  /** Soft-delete a track. Irreversible in practice until T14 ships a trash. */
  'tracks.delete',
  /**
   * Edit a track's metadata — marka, description, internal note (SPEC 7.13).
   * Office work: the warehouse writes the marka through the weighing flow
   * (`tracks.weigh`), it does not re-edit evidence from the track page.
   */
  'tracks.edit',
  /** See customer records and their contact details. */
  'customers.view',
  /** Create or edit a customer. */
  'customers.manage',
  /**
   * See ONE customer's balance. Deliberately separate from `money.reports`: the
   * person handing a parcel over the counter has to know whether it is paid for,
   * and that is not a reason to show them the company's revenue.
   */
  'money.customerDebt',
  /** Tenant-wide money: revenue, the debtor list, dashboard totals, cash by staff. */
  'money.reports',
  /** Take a payment. */
  'payments.record',
  /**
   * Reverse a payment with a storno row (tasks.md A7). Separate from
   * `payments.record` even though both roles that record may currently cancel:
   * voiding money is the capability an owner is most likely to want to tighten
   * later, and a named entry in this matrix is what makes that a one-line change.
   */
  'payments.cancel',
  /** Create/edit batches and move a whole batch's status. */
  'batches.manage',
  /** Run an Excel/text import. */
  'import.run',
  /**
   * Take back an import inside its window (SPEC §7.18, D-010). Deliberately
   * NOT gated on `tracks.delete` (owner-only) even though it soft-deletes: the
   * only rows it can remove are ones this same run created and nobody has
   * touched since, so it undoes an act rather than deleting someone's data.
   * Named separately for the `payments.cancel` reason — tightening it later
   * should be one line in the matrix below.
   */
  'import.undo',
  /** Nudge a debtor (single or all) — routine debt-chasing. */
  'reminders.send',
  /** Message every customer at once. A different weight class from a reminder. */
  'broadcast.send',
  /** Download Excel exports. */
  'export.data',
  /** Tariffs, currency, office info, China template, reminders, webhook. */
  'settings.manage',
  /** Invite/deactivate employees, change roles, revoke sessions. */
  'team.manage',
  /**
   * Work the ticket desk: read threads, reply, change status, assign (H3,
   * SPEC 5.16). Office work — a warehouse hand's evidence enters as photos
   * and events, not as correspondence.
   */
  'tickets.handle',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

/**
 * The matrix. Written out per role rather than derived from a hierarchy: these
 * are three different JOBS, not three rungs of a ladder, and an explicit table
 * is the one form where "can a warehouse hand see revenue?" is answered by
 * looking rather than by reasoning.
 */
export const ROLE_CAPABILITIES: Record<AdminRole, readonly Capability[]> = {
  /** The company. Everything, including the things that cost money to undo. */
  owner: CAPABILITIES,

  /**
   * Office staff: the whole daily operation — import, assign, weigh, take
   * payments, chase debts — but nothing that reprices the company (tariffs,
   * currency), reaches every customer at once, deletes history, or grants
   * access. Those are the owner's to answer for.
   */
  manager: [
    'tracks.view',
    'tracks.status',
    'tracks.weigh',
    'tracks.assign',
    'tracks.edit',
    'customers.view',
    'customers.manage',
    'money.customerDebt',
    'money.reports',
    'payments.record',
    'payments.cancel',
    'batches.manage',
    'import.run',
    'import.undo',
    'reminders.send',
    'export.data',
    'tickets.handle',
  ],

  /**
   * Warehouse hands, in China and in Tashkent. They weigh, photograph and move
   * parcels, look up who a parcel belongs to, and see that one customer's
   * balance at handover. No cash, no customer records, no company figures.
   *
   * `tracks.assign` is theirs because attribution happens at intake, not in the
   * office: the person holding the box is the one reading the marka off it, and
   * the /weigh console's marka field is the daily path from "unowned parcel" to
   * "this customer's parcel" (tasks.md W2). Withholding it would leave the China
   * warehouse — which IS this role — able to weigh but not to say whose it is.
   */
  warehouse: [
    'tracks.view',
    'tracks.status',
    'tracks.weigh',
    'tracks.assign',
    'customers.view',
    'money.customerDebt',
  ],
};

/**
 * Normalize whatever the `role` column holds into a role this module knows.
 *
 * The enum still accepts the retired `staff` value so pre-migration rows remain
 * readable; everyone who held it was doing office work, so it reads as
 * `manager`. An unrecognized value falls back to `warehouse` — the least
 * privileged role — because an unknown role must never mean "allow".
 */
export function toAdminRole(role: string | null | undefined): AdminRole {
  if (role === 'owner' || role === 'manager' || role === 'warehouse') {
    return role;
  }
  if (role === 'staff') return 'manager';
  return 'warehouse';
}

/** Whether `role` is allowed to `capability`. The only permission predicate. */
export function can(
  role: string | null | undefined,
  capability: Capability,
): boolean {
  return ROLE_CAPABILITIES[toAdminRole(role)].includes(capability);
}

/** Whether `role` is allowed to do every one of `capabilities`. */
export function canAll(
  role: string | null | undefined,
  capabilities: readonly Capability[],
): boolean {
  return capabilities.every((c) => can(role, c));
}

/**
 * Whether this employee can sign in to the panel right now.
 *
 * `phone` and `password_hash` are nullable because bot-only staff are a real
 * state: everyone migrated out of `settings.staff_tg_ids` arrived with neither,
 * and an invited employee has a row before they have a password. Both must be
 * present, and the row must still be active.
 */
export function canSignIn(admin: {
  phone: string | null;
  passwordHash: string | null;
  active: boolean;
}): boolean {
  return admin.active && admin.phone !== null && admin.passwordHash !== null;
}

/**
 * Whether this employee may use the bot's staff mode — weighing and warehouse
 * photos (SPEC §3.8). Every role qualifies (an owner weighs parcels too); what
 * gates it is having linked a Telegram account and still being employed.
 */
export function canUseStaffMode(admin: {
  tgUserId: number | null;
  active: boolean;
  role: string | null;
}): boolean {
  return (
    admin.active && admin.tgUserId !== null && can(admin.role, 'tracks.weigh')
  );
}

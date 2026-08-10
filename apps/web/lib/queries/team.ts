/**
 * Employee records for the team screen (SPEC §5.12, AUDIT.md T8).
 *
 * Every query is scoped by the caller's `tenantId` (CLAUDE.md rule 1) — an owner
 * administers their own company's staff and no one else's, and `adminUserId`
 * arrives from a form, so it is always paired with the tenant in the WHERE.
 */

import 'server-only';

import { and, asc, eq, isNull, sql } from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import { adminInvites, adminUsers } from '@kargotrack/db/schema';
import { toAdminRole, type AdminRole } from '@kargotrack/shared';

export interface TeamInvite {
  code: string;
  expiresAt: Date;
}

export interface TeamMember {
  id: string;
  fullName: string | null;
  phone: string | null;
  role: AdminRole;
  active: boolean;
  /** Whether they have linked a Telegram account for bot staff mode. */
  tgLinked: boolean;
  /** Whether they can sign in to the panel at all (bot-only staff cannot). */
  hasPassword: boolean;
  lastLoginAt: Date | null;
  /** The live invitation, when they have not set a password yet. */
  invite: TeamInvite | null;
}

/**
 * Everyone on a tenant's payroll, active first then by name.
 *
 * The pending invite is joined in rather than fetched per row: the screen has to
 * show the code next to the person, and a team is a handful of rows, so one
 * query with a LEFT JOIN beats N+1 by every measure that matters here.
 */
export async function listTeam(tenantId: string): Promise<TeamMember[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: adminUsers.id,
      fullName: adminUsers.fullName,
      phone: adminUsers.phone,
      role: adminUsers.role,
      active: adminUsers.active,
      tgUserId: adminUsers.tgUserId,
      passwordHash: adminUsers.passwordHash,
      lastLoginAt: adminUsers.lastLoginAt,
      inviteCode: adminInvites.code,
      inviteExpiresAt: adminInvites.expiresAt,
    })
    .from(adminUsers)
    .leftJoin(
      adminInvites,
      and(
        eq(adminInvites.adminUserId, adminUsers.id),
        isNull(adminInvites.acceptedAt),
      ),
    )
    .where(eq(adminUsers.tenantId, tenantId))
    // Deactivated people sink to the bottom; the rest sort by name, with the
    // unnamed (bot-only, freshly migrated) rows last so they read as a to-do.
    .orderBy(
      sql`${adminUsers.active} DESC`,
      sql`${adminUsers.fullName} ASC NULLS LAST`,
      asc(adminUsers.createdAt),
    );

  return rows.map((r) => ({
    id: r.id,
    fullName: r.fullName,
    phone: r.phone,
    role: toAdminRole(r.role),
    active: r.active,
    tgLinked: r.tgUserId != null,
    hasPassword: r.passwordHash != null,
    lastLoginAt: r.lastLoginAt,
    invite:
      r.inviteCode && r.inviteExpiresAt
        ? { code: r.inviteCode, expiresAt: r.inviteExpiresAt }
        : null,
  }));
}

/** How many active owners the tenant has. Guards the last-owner rule. */
export async function countActiveOwners(tenantId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(adminUsers)
    .where(
      and(
        eq(adminUsers.tenantId, tenantId),
        eq(adminUsers.role, 'owner'),
        eq(adminUsers.active, true),
      ),
    );
  return row?.n ?? 0;
}

/** One employee, scoped to the tenant. `null` when the id is not theirs. */
export async function getTeamMember(tenantId: string, adminUserId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(adminUsers)
    .where(
      and(eq(adminUsers.id, adminUserId), eq(adminUsers.tenantId, tenantId)),
    )
    .limit(1);
  return row ?? null;
}

/** An active employee of this tenant holding `phone`, if any. */
export async function findMemberByPhone(tenantId: string, phone: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(adminUsers)
    .where(and(eq(adminUsers.tenantId, tenantId), eq(adminUsers.phone, phone)))
    .limit(1);
  return row ?? null;
}

export interface CreateMemberInput {
  tenantId: string;
  phone: string;
  fullName: string | null;
  role: AdminRole;
  code: string;
  expiresAt: Date;
  createdBy: string;
}

/**
 * Add an employee and their invitation in one transaction.
 *
 * The `admin_users` row is created up front, before the code is ever redeemed,
 * so the person appears on the team screen as "pending" and can be given a role
 * — and be linked to Telegram from the bot — before they first sign in.
 */
export async function createTeamMember(
  input: CreateMemberInput,
): Promise<string> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [member] = await tx
      .insert(adminUsers)
      .values({
        tenantId: input.tenantId,
        phone: input.phone,
        fullName: input.fullName,
        role: input.role,
        // No password: they choose it themselves when they redeem the code.
        passwordHash: null,
      })
      .returning({ id: adminUsers.id });
    if (!member) throw new Error('admin insert failed');

    await tx.insert(adminInvites).values({
      tenantId: input.tenantId,
      adminUserId: member.id,
      code: input.code,
      expiresAt: input.expiresAt,
      createdBy: input.createdBy,
    });

    return member.id;
  });
}

/**
 * Issue a fresh code for an existing employee, replacing any live one.
 *
 * Used both to re-invite someone whose code expired and to give panel access to
 * a bot-only warehouse hand, which is why it also writes the phone: those rows
 * were migrated out of `settings.staff_tg_ids` with no phone at all.
 */
export async function replaceInvite(input: {
  tenantId: string;
  adminUserId: string;
  phone: string;
  code: string;
  expiresAt: Date;
  createdBy: string;
}): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .delete(adminInvites)
      .where(
        and(
          eq(adminInvites.adminUserId, input.adminUserId),
          eq(adminInvites.tenantId, input.tenantId),
          isNull(adminInvites.acceptedAt),
        ),
      );
    await tx
      .update(adminUsers)
      .set({ phone: input.phone })
      .where(
        and(
          eq(adminUsers.id, input.adminUserId),
          eq(adminUsers.tenantId, input.tenantId),
        ),
      );
    await tx.insert(adminInvites).values({
      tenantId: input.tenantId,
      adminUserId: input.adminUserId,
      code: input.code,
      expiresAt: input.expiresAt,
      createdBy: input.createdBy,
    });
  });
}

/** Withdraw a pending invitation. The employee row stays. */
export async function revokeInvite(
  tenantId: string,
  adminUserId: string,
): Promise<void> {
  const db = getDb();
  await db
    .delete(adminInvites)
    .where(
      and(
        eq(adminInvites.adminUserId, adminUserId),
        eq(adminInvites.tenantId, tenantId),
        isNull(adminInvites.acceptedAt),
      ),
    );
}

/** Change an employee's role. Takes effect on their next request. */
export async function setMemberRole(
  tenantId: string,
  adminUserId: string,
  role: AdminRole,
): Promise<void> {
  const db = getDb();
  await db
    .update(adminUsers)
    .set({ role })
    .where(
      and(eq(adminUsers.id, adminUserId), eq(adminUsers.tenantId, tenantId)),
    );
}

/**
 * Activate or deactivate an employee.
 *
 * Deactivating bumps `session_epoch` in the same statement, so the person is
 * signed out of every device at once instead of keeping a 30-day cookie. It also
 * ends their bot staff mode, since that reads the same row.
 */
export async function setMemberActive(
  tenantId: string,
  adminUserId: string,
  active: boolean,
): Promise<void> {
  const db = getDb();
  await db
    .update(adminUsers)
    .set(
      active
        ? { active: true }
        : { active: false, sessionEpoch: sql`${adminUsers.sessionEpoch} + 1` },
    )
    .where(
      and(eq(adminUsers.id, adminUserId), eq(adminUsers.tenantId, tenantId)),
    );
}

/** Invalidate every session token issued for this employee. */
export async function revokeSessions(
  tenantId: string,
  adminUserId: string,
): Promise<void> {
  const db = getDb();
  await db
    .update(adminUsers)
    .set({ sessionEpoch: sql`${adminUsers.sessionEpoch} + 1` })
    .where(
      and(eq(adminUsers.id, adminUserId), eq(adminUsers.tenantId, tenantId)),
    );
}

/** Unlink an employee's Telegram account, ending their bot staff mode. */
export async function unlinkTelegram(
  tenantId: string,
  adminUserId: string,
): Promise<void> {
  const db = getDb();
  await db
    .update(adminUsers)
    .set({ tgUserId: null })
    .where(
      and(eq(adminUsers.id, adminUserId), eq(adminUsers.tenantId, tenantId)),
    );
}

/**
 * Set a new password and invalidate every existing session in one statement.
 *
 * The two belong together: a password changed because it leaked is not changed
 * at all while the cookie it protected is still valid. Returns the new epoch,
 * which the caller re-signs the current device's cookie with so the person
 * changing their own password is not signed out by their own action.
 */
export async function setPassword(
  adminUserId: string,
  passwordHash: string,
): Promise<number> {
  const db = getDb();
  const [row] = await db
    .update(adminUsers)
    .set({ passwordHash, sessionEpoch: sql`${adminUsers.sessionEpoch} + 1` })
    .where(eq(adminUsers.id, adminUserId))
    .returning({ sessionEpoch: adminUsers.sessionEpoch });
  if (!row) throw new Error('password update matched no admin');
  return row.sessionEpoch;
}

export interface PendingInvite {
  inviteId: string;
  adminUserId: string;
  tenantId: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  lang: 'uz' | 'ru';
  /** Raw `admin_users.role` — the caller lands them on the right home screen. */
  role: string;
}

/**
 * Find an unredeemed invitation by code + the phone it was issued to.
 *
 * Matched on both because redemption happens on /login, which has no tenant:
 * the code alone identifies the row, and the phone is what proves the person
 * holding it is the person it was meant for.
 */
export async function findInviteByCodeAndPhone(
  code: string,
  phone: string,
): Promise<PendingInvite | null> {
  const db = getDb();
  const [row] = await db
    .select({
      inviteId: adminInvites.id,
      adminUserId: adminInvites.adminUserId,
      tenantId: adminInvites.tenantId,
      expiresAt: adminInvites.expiresAt,
      acceptedAt: adminInvites.acceptedAt,
      lang: adminUsers.lang,
      role: adminUsers.role,
    })
    .from(adminInvites)
    .innerJoin(adminUsers, eq(adminUsers.id, adminInvites.adminUserId))
    .where(
      and(
        eq(adminInvites.code, code),
        eq(adminUsers.phone, phone),
        isNull(adminInvites.acceptedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Redeem an invitation: set the password and mark the code used, atomically.
 *
 * The `accepted_at IS NULL` predicate is repeated inside the transaction on
 * purpose — it is what makes two people racing the same code end with one
 * winner, rather than both being told they succeeded.
 *
 * Returns the resulting `session_epoch`, which the caller MUST sign the new
 * cookie with. The epoch is bumped here for the same reason a password change
 * bumps it — and not returning it was a real bug: re-inviting someone whose
 * sessions had been revoked left the row at epoch 1 while the fresh cookie said
 * 0, so redemption "succeeded" and bounced them straight back to /login.
 */
export async function acceptInvite(input: {
  inviteId: string;
  adminUserId: string;
  passwordHash: string;
}): Promise<number | null> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const claimed = await tx
      .update(adminInvites)
      .set({ acceptedAt: new Date() })
      .where(
        and(
          eq(adminInvites.id, input.inviteId),
          isNull(adminInvites.acceptedAt),
        ),
      )
      .returning({ id: adminInvites.id });
    if (claimed.length === 0) return null;

    const [row] = await tx
      .update(adminUsers)
      .set({
        passwordHash: input.passwordHash,
        active: true,
        sessionEpoch: sql`${adminUsers.sessionEpoch} + 1`,
      })
      .where(eq(adminUsers.id, input.adminUserId))
      .returning({ sessionEpoch: adminUsers.sessionEpoch });
    return row?.sessionEpoch ?? null;
  });
}

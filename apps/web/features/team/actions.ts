'use server';

import crypto from 'node:crypto';

import { hash, verify } from '@node-rs/argon2';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';

import {
  ADMIN_ROLES,
  generateInviteCode,
  inviteExpiry,
  isValidPassword,
  type AdminRole,
} from '@kargotrack/shared';

import { authorize, requireAdmin } from '@/lib/auth';
import { canonicalAdminPhone } from '@/lib/admin-phone';
import {
  countActiveOwners,
  createTeamMember,
  findMemberByPhone,
  getTeamMember,
  replaceInvite,
  revokeInvite,
  revokeSessions,
  setMemberActive,
  setMemberRole,
  setPassword,
  unlinkTelegram,
} from '@/lib/queries';
import {
  COOKIE_NAME,
  MAX_AGE_SECONDS,
  createSessionToken,
} from '@/lib/session';

export interface TeamState {
  ok?: boolean;
  error?: string;
  /** The code to show the owner, on a successful invite. */
  code?: string;
}

const TEAM_PATH = '/settings/team';

const roleSchema = z.enum(ADMIN_ROLES);
const idSchema = z.string().uuid();

/** A fresh, unguessable invite code from the platform's CSPRNG. */
function newCode(): string {
  return generateInviteCode((size) => crypto.randomBytes(size));
}

/**
 * Add an employee and issue their invitation (SPEC §5.12).
 *
 * The owner supplies a phone, a name and a role — never a password. The invitee
 * sets that themselves with the returned code, so no one but them ever knows it
 * and `created_by` on a payment means what it says.
 */
export async function inviteMemberAction(input: {
  phone: string;
  fullName: string;
  role: string;
}): Promise<TeamState> {
  const auth = await authorize('team.manage');
  if (!auth.ok) return { error: auth.error };
  const { admin, tenant } = auth.ctx;

  const t = await getTranslations('team');

  const role = roleSchema.safeParse(input.role);
  if (!role.success) return { error: t('invalidRole') };

  const phone = canonicalAdminPhone(input.phone);
  if (!phone) return { error: t('invalidPhone') };

  // One employee per number inside a company: two rows sharing a phone would
  // make login pick whichever argon2 verified first, and the audit trail would
  // name a coin flip. Across tenants it stays legal.
  const existing = await findMemberByPhone(tenant.id, phone);
  if (existing) return { error: t('phoneTaken') };

  const code = newCode();
  await createTeamMember({
    tenantId: tenant.id,
    phone,
    fullName: input.fullName.trim() || null,
    role: role.data,
    code,
    expiresAt: inviteExpiry(),
    createdBy: admin.id,
  });

  revalidatePath(TEAM_PATH);
  return { ok: true, code };
}

/**
 * Issue a fresh code for someone who already has a row — an expired invite, or
 * a bot-only warehouse hand being given panel access for the first time.
 */
export async function reinviteMemberAction(input: {
  adminUserId: string;
  phone: string;
}): Promise<TeamState> {
  const auth = await authorize('team.manage');
  if (!auth.ok) return { error: auth.error };
  const { admin, tenant } = auth.ctx;

  const t = await getTranslations('team');

  const id = idSchema.safeParse(input.adminUserId);
  if (!id.success) return { error: t('memberNotFound') };

  const member = await getTeamMember(tenant.id, id.data);
  if (!member) return { error: t('memberNotFound') };

  const phone = canonicalAdminPhone(input.phone);
  if (!phone) return { error: t('invalidPhone') };

  const clash = await findMemberByPhone(tenant.id, phone);
  if (clash && clash.id !== member.id) return { error: t('phoneTaken') };

  const code = newCode();
  await replaceInvite({
    tenantId: tenant.id,
    adminUserId: member.id,
    phone,
    code,
    expiresAt: inviteExpiry(),
    createdBy: admin.id,
  });

  revalidatePath(TEAM_PATH);
  return { ok: true, code };
}

/** Withdraw a pending invitation. */
export async function revokeInviteAction(
  adminUserId: string,
): Promise<TeamState> {
  const auth = await authorize('team.manage');
  if (!auth.ok) return { error: auth.error };

  const t = await getTranslations('team');
  const id = idSchema.safeParse(adminUserId);
  if (!id.success) return { error: t('memberNotFound') };

  await revokeInvite(auth.ctx.tenant.id, id.data);
  revalidatePath(TEAM_PATH);
  return { ok: true };
}

/**
 * Change an employee's role.
 *
 * Takes effect on their next request — the role is read from the row on every
 * page load, so there is no session to invalidate and no reason to sign a
 * working colleague out mid-shift.
 */
export async function changeMemberRoleAction(input: {
  adminUserId: string;
  role: string;
}): Promise<TeamState> {
  const auth = await authorize('team.manage');
  if (!auth.ok) return { error: auth.error };
  const { admin, tenant } = auth.ctx;

  const t = await getTranslations('team');

  const id = idSchema.safeParse(input.adminUserId);
  const role = roleSchema.safeParse(input.role);
  if (!id.success) return { error: t('memberNotFound') };
  if (!role.success) return { error: t('invalidRole') };

  const member = await getTeamMember(tenant.id, id.data);
  if (!member) return { error: t('memberNotFound') };

  // Lock-out guard: demoting the last owner would leave a company with nobody
  // who can set tariffs or hire, and no way back in without database access.
  if (
    member.role === 'owner' &&
    role.data !== 'owner' &&
    (await countActiveOwners(tenant.id)) <= 1
  ) {
    return { error: t('lastOwner') };
  }

  await setMemberRole(tenant.id, member.id, role.data as AdminRole);
  revalidatePath(TEAM_PATH);
  // Their own role changed under them — re-render the nav they are looking at.
  if (member.id === admin.id) revalidatePath('/', 'layout');
  return { ok: true };
}

/** Deactivate (or reinstate) an employee. Deactivating ends every session. */
export async function setMemberActiveAction(input: {
  adminUserId: string;
  active: boolean;
}): Promise<TeamState> {
  const auth = await authorize('team.manage');
  if (!auth.ok) return { error: auth.error };
  const { admin, tenant } = auth.ctx;

  const t = await getTranslations('team');

  const id = idSchema.safeParse(input.adminUserId);
  if (!id.success) return { error: t('memberNotFound') };

  const member = await getTeamMember(tenant.id, id.data);
  if (!member) return { error: t('memberNotFound') };

  if (!input.active) {
    if (member.id === admin.id) return { error: t('cannotDeactivateSelf') };
    if (member.role === 'owner' && (await countActiveOwners(tenant.id)) <= 1) {
      return { error: t('lastOwner') };
    }
  }

  await setMemberActive(tenant.id, member.id, input.active);
  revalidatePath(TEAM_PATH);
  return { ok: true };
}

/** Sign an employee out of every device without changing their password. */
export async function revokeSessionsAction(
  adminUserId: string,
): Promise<TeamState> {
  const auth = await authorize('team.manage');
  if (!auth.ok) return { error: auth.error };

  const t = await getTranslations('team');
  const id = idSchema.safeParse(adminUserId);
  if (!id.success) return { error: t('memberNotFound') };

  const member = await getTeamMember(auth.ctx.tenant.id, id.data);
  if (!member) return { error: t('memberNotFound') };

  await revokeSessions(auth.ctx.tenant.id, member.id);
  revalidatePath(TEAM_PATH);
  return { ok: true };
}

/** Unlink an employee's Telegram, ending their bot staff mode. */
export async function unlinkTelegramAction(
  adminUserId: string,
): Promise<TeamState> {
  const auth = await authorize('team.manage');
  if (!auth.ok) return { error: auth.error };

  const t = await getTranslations('team');
  const id = idSchema.safeParse(adminUserId);
  if (!id.success) return { error: t('memberNotFound') };

  const member = await getTeamMember(auth.ctx.tenant.id, id.data);
  if (!member) return { error: t('memberNotFound') };

  await unlinkTelegram(auth.ctx.tenant.id, member.id);
  revalidatePath(TEAM_PATH);
  return { ok: true };
}

export interface PasswordState {
  ok?: boolean;
  error?: string;
}

/**
 * Change your own password (any role — this is the one account control that must
 * never require asking someone else).
 *
 * Requires the current password: a session left open on a warehouse PC must not
 * be enough to lock its owner out. Every other session is invalidated, and this
 * device's cookie is re-signed with the new epoch so the person doing it is not
 * signed out by their own action.
 */
export async function changeOwnPasswordAction(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<PasswordState> {
  const { admin } = await requireAdmin();
  const t = await getTranslations('team');

  if (!isValidPassword(input.newPassword)) {
    return { error: t('passwordTooShort') };
  }

  // Bot-only staff have no password to verify against; they need an invite.
  if (admin.passwordHash == null) return { error: t('noPasswordSet') };

  let matches = false;
  try {
    matches = await verify(admin.passwordHash, input.currentPassword);
  } catch {
    matches = false;
  }
  if (!matches) return { error: t('wrongCurrentPassword') };

  const epoch = await setPassword(admin.id, await hash(input.newPassword));

  cookies().set(COOKIE_NAME, createSessionToken(admin.id, epoch), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });

  return { ok: true };
}

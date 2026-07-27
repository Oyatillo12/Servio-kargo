/**
 * Session → admin/tenant resolution, the route guard, and the permission gate.
 *
 * `getSessionAdmin` reads the signed cookie and loads the admin + their tenant.
 * `requireAdmin` is the guard every protected page/action calls; the returned
 * `tenant.id` is the ONLY tenant id used to scope queries (CLAUDE.md rule 1).
 *
 * Authentication answers "who are you"; `requireCapability` / `authorize` answer
 * "may you". Both are needed on every mutating path: hiding a button is a
 * courtesy to the person, not a control — a Server Action is a POST endpoint and
 * anyone signed in can call it directly (AUDIT.md T8).
 */

import 'server-only';

import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getDb } from '@kargotrack/db';
import {
  adminUsers,
  tenants,
  type AdminUser,
  type Tenant,
} from '@kargotrack/db/schema';
import { can, toAdminRole, type AdminRole, type Capability } from '@kargotrack/shared';

import { COOKIE_NAME, verifySessionToken } from './session';

export interface AdminContext {
  admin: AdminUser;
  tenant: Tenant;
  /** `admin.role` narrowed through `toAdminRole` — use this, not the raw column. */
  role: AdminRole;
}

/** Resolve the logged-in admin + tenant from the session cookie, or `null`. */
export async function getSessionAdmin(): Promise<AdminContext | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  const claims = verifySessionToken(token);
  if (!claims) return null;

  const db = getDb();
  const [admin] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.id, claims.adminUserId))
    .limit(1);
  if (!admin) return null;

  // Deactivated employees are signed out on their next request. Their row stays
  // so the tracks and payments they touched keep naming them.
  if (!admin.active) return null;

  // Revocation: a password change, "sign out everywhere", or deactivation bumps
  // the column, and every token signed against the older epoch dies here.
  if (claims.epoch !== admin.sessionEpoch) return null;

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, admin.tenantId))
    .limit(1);
  if (!tenant) return null;

  return { admin, tenant, role: toAdminRole(admin.role) };
}

/** Guard: return the admin context or redirect to /login. */
export async function requireAdmin(): Promise<AdminContext> {
  const ctx = await getSessionAdmin();
  if (!ctx) redirect('/login');
  return ctx;
}

/**
 * Page guard: the admin context, or a redirect away when they lack `capability`.
 *
 * Sends them to the dashboard rather than showing a 403, because every role can
 * open it — the alternative is a dead end with no way back on a phone.
 */
export async function requireCapability(
  capability: Capability,
): Promise<AdminContext> {
  const ctx = await requireAdmin();
  if (!can(ctx.role, capability)) redirect('/dashboard');
  return ctx;
}

export type AuthorizeResult =
  | { ok: true; ctx: AdminContext }
  | { ok: false; error: string };

/**
 * Server Action gate. Returns the context or a finished, translated error the
 * caller hands straight to `toast.error` (CLAUDE.md rule 5).
 *
 * Actions return `{ error }` states rather than throwing, so this matches: a
 * refusal should read as "you are not allowed to do that", not as a crashed
 * page. Every mutating action calls it — including the ones whose button is
 * already hidden, since the button is not what stops the request.
 */
export async function authorize(
  capability: Capability,
): Promise<AuthorizeResult> {
  const ctx = await requireAdmin();
  if (!can(ctx.role, capability)) {
    const t = await getTranslations('auth');
    return { ok: false, error: t('forbidden') };
  }
  return { ok: true, ctx };
}

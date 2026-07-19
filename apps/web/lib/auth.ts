/**
 * Session → admin/tenant resolution and the route guard.
 *
 * `getSessionAdmin` reads the signed cookie and loads the admin + their tenant.
 * `requireAdmin` is the guard every protected page/action calls; the returned
 * `tenant.id` is the ONLY tenant id used to scope queries (CLAUDE.md rule 1).
 */

import 'server-only';

import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { getDb } from '@kargotrack/db';
import {
  adminUsers,
  tenants,
  type AdminUser,
  type Tenant,
} from '@kargotrack/db/schema';

import { COOKIE_NAME, verifySessionToken } from './session';

export interface AdminContext {
  admin: AdminUser;
  tenant: Tenant;
}

/** Resolve the logged-in admin + tenant from the session cookie, or `null`. */
export async function getSessionAdmin(): Promise<AdminContext | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  const adminUserId = verifySessionToken(token);
  if (!adminUserId) return null;

  const db = getDb();
  const [admin] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.id, adminUserId))
    .limit(1);
  if (!admin) return null;

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, admin.tenantId))
    .limit(1);
  if (!tenant) return null;

  return { admin, tenant };
}

/** Guard: return the admin context or redirect to /login. */
export async function requireAdmin(): Promise<AdminContext> {
  const ctx = await getSessionAdmin();
  if (!ctx) redirect('/login');
  return ctx;
}

/**
 * Mini App data access (tasks.md B). Deliberately NOT in the `lib/queries`
 * barrel: that surface is scoped by the ADMIN session; everything here is
 * scoped by the TWA customer session (tenant_id + customer_id from the
 * verified cookie), and nothing must leak between the two.
 */

import 'server-only';

import { and, eq } from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import { customers, tenants, type Customer } from '@kargotrack/db/schema';
import type { TenantPlan } from '@kargotrack/shared';

export interface TwaTenant {
  id: string;
  name: string;
  plan: TenantPlan;
  /** Needed server-side to validate initData; NEVER sent to the client. */
  botToken: string;
  botUsername: string | null;
}

export async function getTwaTenant(
  tenantId: string,
): Promise<TwaTenant | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      plan: tenants.plan,
      botToken: tenants.botToken,
      botUsername: tenants.botUsername,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  return row ?? null;
}

export async function getTwaCustomerByTg(
  tenantId: string,
  tgUserId: number,
): Promise<Customer | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(customers)
    .where(
      and(eq(customers.tenantId, tenantId), eq(customers.tgUserId, tgUserId)),
    )
    .limit(1);
  return row ?? null;
}

export async function getTwaCustomerById(
  tenantId: string,
  customerId: string,
): Promise<Customer | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.tenantId, tenantId), eq(customers.id, customerId)))
    .limit(1);
  return row ?? null;
}

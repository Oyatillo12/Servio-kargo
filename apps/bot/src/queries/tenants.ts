/** Tenant + tariff lookups — the bot's per-company configuration reads. */

import { and, asc, desc, eq } from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import {
  tariffs,
  tenants,
  type Tariff,
  type Tenant,
} from '@kargotrack/db/schema';

export async function getTenantById(id: string): Promise<Tenant | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, id))
    .limit(1);
  return row;
}

export async function getTenantByToken(
  token: string,
): Promise<Tenant | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.botToken, token))
    .limit(1);
  return row;
}

export async function listTenants(): Promise<Tenant[]> {
  return getDb().select().from(tenants);
}

/** Active tariffs for a tenant, default first (SPEC §3.5 info card). */
export async function getActiveTariffs(tenantId: string): Promise<Tariff[]> {
  const db = getDb();
  return db
    .select()
    .from(tariffs)
    .where(and(eq(tariffs.tenantId, tenantId), eq(tariffs.active, true)))
    .orderBy(desc(tariffs.isDefault), asc(tariffs.sort), asc(tariffs.name));
}

/** The tenant's single active default tariff (CLAUDE.md: always exactly one). */
export async function getDefaultTariff(
  tenantId: string,
): Promise<Tariff | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(tariffs)
    .where(
      and(
        eq(tariffs.tenantId, tenantId),
        eq(tariffs.isDefault, true),
        eq(tariffs.active, true),
      ),
    )
    .limit(1);
  return row;
}

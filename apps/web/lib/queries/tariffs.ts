/**
 * Tariffs (SPEC §5.9, §7.4). The "exactly one active default" invariant is
 * enforced by the shared planners, not by ad-hoc checks here.
 */

import 'server-only';

import { and, asc, desc, eq, inArray } from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import { tariffs, type Tariff } from '@kargotrack/db/schema';
import {
  planCreateTariff,
  planDelete,
  planSetActive,
} from '@kargotrack/shared';

/** All tariffs for a tenant, default first then by sort/name. */
export async function listTariffs(tenantId: string): Promise<Tariff[]> {
  return getDb()
    .select()
    .from(tariffs)
    .where(eq(tariffs.tenantId, tenantId))
    .orderBy(desc(tariffs.isDefault), asc(tariffs.sort), asc(tariffs.name));
}

/** Active tariffs only (for the bot info card + track/import selects). */
export async function listActiveTariffs(tenantId: string): Promise<Tariff[]> {
  return getDb()
    .select()
    .from(tariffs)
    .where(and(eq(tariffs.tenantId, tenantId), eq(tariffs.active, true)))
    .orderBy(desc(tariffs.isDefault), asc(tariffs.sort), asc(tariffs.name));
}

/** The tenant's active default tariff (SPEC §7.4), or null if none set yet. */
export async function getDefaultTariff(tenantId: string): Promise<Tariff | null> {
  const [row] = await getDb()
    .select()
    .from(tariffs)
    .where(and(eq(tariffs.tenantId, tenantId), eq(tariffs.isDefault, true)))
    .limit(1);
  return row ?? null;
}

/**
 * Create a tariff, enforcing "exactly one active default" via the shared
 * planner (§5.9): the first tariff is forced active-default; a new default
 * demotes the previous one and is forced active.
 */
export async function createTariff(args: {
  tenantId: string;
  name: string;
  pricePerKgMinor: number;
  isDefault: boolean;
  active: boolean;
}): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: tariffs.id, isDefault: tariffs.isDefault, active: tariffs.active })
      .from(tariffs)
      .where(eq(tariffs.tenantId, args.tenantId));
    const plan = planCreateTariff(existing, {
      isDefault: args.isDefault,
      active: args.active,
    });
    if (plan.unsetDefaultIds.length > 0) {
      await tx
        .update(tariffs)
        .set({ isDefault: false })
        .where(inArray(tariffs.id, plan.unsetDefaultIds));
    }
    await tx.insert(tariffs).values({
      tenantId: args.tenantId,
      name: args.name,
      pricePerKgMinor: args.pricePerKgMinor,
      isDefault: plan.isDefault,
      active: plan.active,
    });
  });
}

/** Rename / re-price a tariff. Tenant-scoped; does not touch default/active. */
export async function updateTariff(args: {
  tenantId: string;
  tariffId: string;
  name: string;
  pricePerKgMinor: number;
}): Promise<void> {
  await getDb()
    .update(tariffs)
    .set({ name: args.name, pricePerKgMinor: args.pricePerKgMinor })
    .where(
      and(eq(tariffs.tenantId, args.tenantId), eq(tariffs.id, args.tariffId)),
    );
}

/**
 * Promote a tariff to the tenant's default (§5.9): it becomes default + active,
 * all other defaults are cleared. Returns false if the tariff doesn't exist.
 */
export async function setDefaultTariff(
  tenantId: string,
  tariffId: string,
): Promise<boolean> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: tariffs.id, isDefault: tariffs.isDefault, active: tariffs.active })
      .from(tariffs)
      .where(eq(tariffs.tenantId, tenantId));
    if (!rows.some((r) => r.id === tariffId)) return false;
    await tx
      .update(tariffs)
      .set({ isDefault: false })
      .where(and(eq(tariffs.tenantId, tenantId), eq(tariffs.isDefault, true)));
    await tx
      .update(tariffs)
      .set({ isDefault: true, active: true })
      .where(and(eq(tariffs.tenantId, tenantId), eq(tariffs.id, tariffId)));
    return true;
  });
}

/**
 * Toggle a tariff's active flag. Refuses to deactivate the default (§5.9).
 * Returns an error code string on refusal, or null on success.
 */
export async function setTariffActive(
  tenantId: string,
  tariffId: string,
  active: boolean,
): Promise<'NOT_FOUND' | 'DEFAULT_MUST_STAY_ACTIVE' | 'CANNOT_DELETE_DEFAULT' | null> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: tariffs.id, isDefault: tariffs.isDefault, active: tariffs.active })
      .from(tariffs)
      .where(eq(tariffs.tenantId, tenantId));
    const res = planSetActive(rows, tariffId, active);
    if (!res.ok) return res.error ?? 'NOT_FOUND';
    await tx
      .update(tariffs)
      .set({ active })
      .where(and(eq(tariffs.tenantId, tenantId), eq(tariffs.id, tariffId)));
    return null;
  });
}

/** Delete a tariff. Refuses to delete the default (§5.9). */
export async function deleteTariff(
  tenantId: string,
  tariffId: string,
): Promise<'NOT_FOUND' | 'DEFAULT_MUST_STAY_ACTIVE' | 'CANNOT_DELETE_DEFAULT' | null> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: tariffs.id, isDefault: tariffs.isDefault, active: tariffs.active })
      .from(tariffs)
      .where(eq(tariffs.tenantId, tenantId));
    const res = planDelete(rows, tariffId);
    if (!res.ok) return res.error ?? 'NOT_FOUND';
    await tx
      .delete(tariffs)
      .where(and(eq(tariffs.tenantId, tenantId), eq(tariffs.id, tariffId)));
    return null;
  });
}

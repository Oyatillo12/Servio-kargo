/**
 * Database access for the super-admin console (SPEC §6). Unlike `lib/queries.ts`
 * these are intentionally NOT tenant-scoped — the super-admin manages tenants
 * across the whole platform. Access is gated by `requireSuperadmin` in the
 * calling page/action, never exposed to tenant admins.
 */

import 'server-only';

import { and, asc, count, desc, eq, isNotNull, isNull } from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import {
  adminUsers,
  customers,
  tariffs,
  tenants,
  tracks,
  type Currency,
  type TenantPlanValue,
  type TenantSettings,
} from '@kargotrack/db/schema';

export interface SaTenantRow {
  id: string;
  name: string;
  botUsername: string | null;
  codePrefix: string;
  plan: TenantPlanValue;
  trackCount: number;
  customerCount: number;
  createdAt: Date;
}

/** Tenants table for the console: identity + live track/customer counts. */
export async function listTenantsForSa(): Promise<SaTenantRow[]> {
  const db = getDb();

  const [rows, trackCounts, customerCounts] = await Promise.all([
    db.select().from(tenants).orderBy(desc(tenants.createdAt)),
    // Non-deleted tracks only (SPEC §7.8).
    db
      .select({ tenantId: tracks.tenantId, n: count() })
      .from(tracks)
      .where(isNull(tracks.deletedAt))
      .groupBy(tracks.tenantId),
    db
      .select({ tenantId: customers.tenantId, n: count() })
      .from(customers)
      .groupBy(customers.tenantId),
  ]);

  const tMap = new Map(trackCounts.map((r) => [r.tenantId, r.n]));
  const cMap = new Map(customerCounts.map((r) => [r.tenantId, r.n]));

  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    botUsername: t.botUsername,
    codePrefix: t.codePrefix,
    plan: t.plan,
    trackCount: tMap.get(t.id) ?? 0,
    customerCount: cMap.get(t.id) ?? 0,
    createdAt: t.createdAt,
  }));
}

/** Switch a tenant's subscription tier (super-admin row action). */
export async function setTenantPlan(
  tenantId: string,
  plan: TenantPlanValue,
): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .update(tenants)
    .set({ plan })
    .where(eq(tenants.id, tenantId))
    .returning({ id: tenants.id });
  return rows.length > 0;
}

/** Pre-check so we can show a friendly message before hitting the unique index. */
export async function tenantTokenExists(botToken: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.botToken, botToken))
    .limit(1);
  return Boolean(row);
}

/** Look up a tenant's bot token by id (server-only; used to re-set webhooks). */
export async function getTenantToken(
  tenantId: string,
): Promise<{ botToken: string; botUsername: string | null } | null> {
  const db = getDb();
  const [row] = await db
    .select({ botToken: tenants.botToken, botUsername: tenants.botUsername })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  return row ?? null;
}

/**
 * The tenant owner a password-reset invite goes to (tasks.md F5): the earliest
 * ACTIVE owner who has a phone — with several owners, the original one; a
 * bot-only owner row (no phone) cannot redeem a code and is skipped.
 */
export async function findOwnerForReset(
  tenantId: string,
): Promise<{ id: string; phone: string; fullName: string | null } | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: adminUsers.id,
      phone: adminUsers.phone,
      fullName: adminUsers.fullName,
    })
    .from(adminUsers)
    .where(
      and(
        eq(adminUsers.tenantId, tenantId),
        eq(adminUsers.role, 'owner'),
        eq(adminUsers.active, true),
        isNotNull(adminUsers.phone),
      ),
    )
    .orderBy(asc(adminUsers.createdAt))
    .limit(1);
  return row ? { ...row, phone: row.phone! } : null;
}

export interface CreateTenantInput {
  name: string;
  codePrefix: string;
  botToken: string;
  botUsername: string | null;
  currency: Currency;
  plan: TenantPlanValue;
  /** Som per 1 USD in tiyin; null when currency is UZS. */
  usdRateTiyin: number | null;
  /** Default tariff price per kg in minor units (tiyin if UZS, cents if USD). */
  defaultTariffMinor: number;
  pickupAddress: string | null;
  workingHours: string | null;
  contactPhone: string | null;
  adminPhone: string;
  adminPasswordHash: string;
}

/** Sensible defaults for a brand-new tenant (weekly reminders off until set up). */
const DEFAULT_SETTINGS: TenantSettings = {
  reminders: { weekly_enabled: false, weekday: 1, hour: 10 },
};

/**
 * Create the tenant and its first `owner` admin atomically (SPEC §6). Returns
 * the new tenant id. Callers must have already validated the token (getMe);
 * the webhook is set AFTER creation, because its URL carries this id (F3).
 */
export async function createTenantWithOwner(
  input: CreateTenantInput,
): Promise<string> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [tenant] = await tx
      .insert(tenants)
      .values({
        name: input.name,
        codePrefix: input.codePrefix,
        botToken: input.botToken,
        botUsername: input.botUsername,
        currency: input.currency,
        plan: input.plan,
        usdRateTiyin: input.usdRateTiyin,
        pickupAddress: input.pickupAddress,
        workingHours: input.workingHours,
        contactPhone: input.contactPhone,
        settings: DEFAULT_SETTINGS,
      })
      .returning({ id: tenants.id });
    if (!tenant) throw new Error('tenant insert failed');

    // Every tenant starts with exactly one active default tariff (SPEC §5.9).
    await tx.insert(tariffs).values({
      tenantId: tenant.id,
      name: 'Asosiy',
      pricePerKgMinor: input.defaultTariffMinor,
      isDefault: true,
      active: true,
    });

    await tx.insert(adminUsers).values({
      tenantId: tenant.id,
      phone: input.adminPhone,
      passwordHash: input.adminPasswordHash,
      role: 'owner',
    });

    return tenant.id;
  });
}

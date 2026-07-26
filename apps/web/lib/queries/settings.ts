/**
 * Tenant settings + billing currency (SPEC §5.7, §5.9).
 */

import 'server-only';

import { eq } from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import { tenants, type Currency, type TenantSettings } from '@kargotrack/db/schema';

/** Update a tenant's office info and settings jsonb. Tenant-scoped. */
export async function updateTenantSettings(args: {
  tenantId: string;
  pickupAddress: string | null;
  workingHours: string | null;
  contactPhone: string | null;
  settings: TenantSettings;
}): Promise<void> {
  await getDb()
    .update(tenants)
    .set({
      pickupAddress: args.pickupAddress,
      workingHours: args.workingHours,
      contactPhone: args.contactPhone,
      settings: args.settings,
    })
    .where(eq(tenants.id, args.tenantId));
}

/** Update a tenant's billing currency + USD rate (SPEC §5.9). Tenant-scoped. */
export async function updateTenantCurrency(args: {
  tenantId: string;
  currency: Currency;
  /** Som per 1 USD in tiyin; null when currency is UZS. */
  usdRateTiyin: number | null;
}): Promise<void> {
  await getDb()
    .update(tenants)
    .set({ currency: args.currency, usdRateTiyin: args.usdRateTiyin })
    .where(eq(tenants.id, args.tenantId));
}

/** Customer registration/linking (SPEC §7.12), their tracks, payments and debt. */

import { and, asc, desc, eq, isNull } from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import {
  customers,
  payments,
  tracks,
  type Customer,
  type Payment,
  type Tenant,
  type Track,
} from '@kargotrack/db/schema';
import {
  computeDebtTiyin,
  nextClientCode,
  normalizePhone,
  type DebtTrack,
  type Lang,
} from '@kargotrack/shared';

import { logger } from '../logger';
import { isUniqueViolation } from './internal';

export async function getCustomerByTg(
  tenantId: string,
  tgUserId: number,
): Promise<Customer | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(customers)
    .where(
      and(eq(customers.tenantId, tenantId), eq(customers.tgUserId, tgUserId)),
    )
    .limit(1);
  return row;
}

/**
 * Register (or return the existing) customer for a Telegram user. Assigns
 * `client_code = prefix + '-' + sequence` and retries on the unique-index
 * collision that a concurrent registration could cause.
 *
 * Before creating anything it looks for a record the admin entered by hand
 * (`tg_user_id IS NULL`) carrying the same phone and **links** that one instead
 * (SPEC §7.12). Without this the customer would get a second, empty profile —
 * their imported tracks, debt and payments would all stay on the first one and
 * "Mening yuklarim" would come back empty on day 0.
 */
export async function registerCustomer(args: {
  tenant: Tenant;
  tgUserId: number;
  phone: string;
  fullName: string;
  lang: Lang;
}): Promise<Customer> {
  const db = getDb();
  const { tenant, tgUserId, phone, fullName, lang } = args;
  const phoneNormalized = normalizePhone(phone);

  // A concurrent contact may have already created this customer.
  const existing = await getCustomerByTg(tenant.id, tgUserId);
  if (existing) {
    const [updated] = await db
      .update(customers)
      .set({ phone, phoneNormalized, fullName, lang })
      .where(eq(customers.id, existing.id))
      .returning();
    return updated ?? existing;
  }

  // Claim a hand-entered record with this phone (SPEC §7.12). Scoped to
  // tg_user_id IS NULL so we never steal a row that belongs to another
  // Telegram account that happens to share a number. `fullName` is only
  // overwritten when the admin left it blank — the office spelling of the name
  // is usually the one printed on the invoice.
  if (phoneNormalized) {
    const [pending] = await db
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.tenantId, tenant.id),
          eq(customers.phoneNormalized, phoneNormalized),
          isNull(customers.tgUserId),
        ),
      )
      .orderBy(asc(customers.createdAt))
      .limit(1);

    if (pending) {
      try {
        const [linked] = await db
          .update(customers)
          .set({
            tgUserId,
            phone,
            phoneNormalized,
            fullName: pending.fullName ?? fullName,
            lang,
          })
          .where(
            // Re-assert tg_user_id IS NULL: two /start flows racing on the same
            // pending row must not both think they claimed it.
            and(eq(customers.id, pending.id), isNull(customers.tgUserId)),
          )
          .returning();
        if (linked) {
          logger.info(
            { tenantId: tenant.id, customerId: linked.id },
            'linked telegram user to hand-entered customer by phone',
          );
          return linked;
        }
      } catch (err) {
        // The loser of a race hits customers_tenant_tg_user_uq — fall through
        // and pick up the row the winner just claimed.
        if (!isUniqueViolation(err)) throw err;
      }
      const raced = await getCustomerByTg(tenant.id, tgUserId);
      if (raced) return raced;
    }
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const codeRows = await db
      .select({ clientCode: customers.clientCode })
      .from(customers)
      .where(eq(customers.tenantId, tenant.id));
    const clientCode = nextClientCode(
      tenant.codePrefix,
      codeRows.map((r) => r.clientCode),
    );

    try {
      const [row] = await db
        .insert(customers)
        .values({
          tenantId: tenant.id,
          tgUserId,
          phone,
          phoneNormalized,
          fullName,
          clientCode,
          lang,
        })
        .returning();
      if (row) return row;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // Could be a client_code race (retry) or a tg_user race (return theirs).
      const raced = await getCustomerByTg(tenant.id, tgUserId);
      if (raced) return raced;
      logger.warn(
        { attempt, tenantId: tenant.id },
        'client_code collision, retrying',
      );
    }
  }
  throw new Error('registerCustomer: exhausted client_code retries');
}

export async function setCustomerLang(
  customerId: string,
  lang: Lang,
): Promise<void> {
  await getDb()
    .update(customers)
    .set({ lang })
    .where(eq(customers.id, customerId));
}

/** Non-deleted tracks for a customer (tenant-scoped). */
export async function listCustomerTracks(
  tenantId: string,
  customerId: string,
): Promise<Track[]> {
  const db = getDb();
  return db
    .select()
    .from(tracks)
    .where(
      and(
        eq(tracks.tenantId, tenantId),
        eq(tracks.customerId, customerId),
        isNull(tracks.deletedAt),
      ),
    );
}

export async function listCustomerPayments(
  tenantId: string,
  customerId: string,
): Promise<Payment[]> {
  const db = getDb();
  return db
    .select()
    .from(payments)
    .where(
      and(eq(payments.tenantId, tenantId), eq(payments.customerId, customerId)),
    )
    .orderBy(desc(payments.createdAt));
}

/**
 * Ids of a tenant's customers whose net debt is > 0 (SPEC §7.5), for the weekly
 * reminder sweep (§7.7). Pulls the tenant's non-deleted tracks + all payments
 * once and groups in memory through the shared `computeDebtTiyin` — the single
 * source of the debt rule, matching the admin panel's `listCustomersWithDebt`.
 */
export async function listTenantDebtorIds(tenantId: string): Promise<string[]> {
  const db = getDb();

  const trackRows = await db
    .select({
      customerId: tracks.customerId,
      currentStatus: tracks.currentStatus,
      priceTiyin: tracks.priceTiyin,
      deletedAt: tracks.deletedAt,
    })
    .from(tracks)
    .where(and(eq(tracks.tenantId, tenantId), isNull(tracks.deletedAt)));

  const payRows = await db
    .select({
      customerId: payments.customerId,
      amountTiyin: payments.amountTiyin,
    })
    .from(payments)
    .where(eq(payments.tenantId, tenantId));

  const tracksByCustomer = new Map<string, DebtTrack[]>();
  for (const t of trackRows) {
    if (!t.customerId) continue;
    const list = tracksByCustomer.get(t.customerId) ?? [];
    list.push({
      currentStatus: t.currentStatus,
      priceTiyin: t.priceTiyin,
      deletedAt: t.deletedAt,
    });
    tracksByCustomer.set(t.customerId, list);
  }

  const paymentsByCustomer = new Map<string, { amountTiyin: number }[]>();
  for (const p of payRows) {
    const list = paymentsByCustomer.get(p.customerId) ?? [];
    list.push({ amountTiyin: p.amountTiyin });
    paymentsByCustomer.set(p.customerId, list);
  }

  const debtorIds: string[] = [];
  for (const [customerId, custTracks] of tracksByCustomer) {
    const debt = computeDebtTiyin(
      custTracks,
      paymentsByCustomer.get(customerId) ?? [],
    );
    if (debt > 0) debtorIds.push(customerId);
  }
  return debtorIds;
}

/** A single customer by id (tenant-scoped). */
export async function getCustomerById(
  tenantId: string,
  customerId: string,
): Promise<Customer | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.tenantId, tenantId), eq(customers.id, customerId)))
    .limit(1);
  return row;
}

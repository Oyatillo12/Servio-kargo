/**
 * Customers: picker search, panel-side creation (SPEC §5.5), the list with net
 * debt (§7.5), customer detail, payments and the debtor list (§5.6).
 */

import 'server-only';

import { and, asc, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import { enqueueReminder } from '@kargotrack/db/queue';
import {
  customers,
  payments,
  tracks,
  type Customer,
  type Payment,
  type Track,
} from '@kargotrack/db/schema';
import {
  DEBT_OWED_STATUSES,
  computeDebtTiyin,
  nextClientCode,
  normalizePhone,
  type DebtTrack,
  type Lang,
} from '@kargotrack/shared';

import { CUSTOMER_PICKER_LIMIT, type CustomerOption } from '../customer-types';
import { isUniqueViolation } from './internal';

/**
 * Typeahead search for the assignment picker (SPEC §5.3): client_code, name or
 * phone. Phone terms are matched on `phone_normalized` too, so `+998 90 123 45
 * 67` finds a customer stored as `901234567` (§7.12). An empty term returns the
 * most recent customers, which is the common case right after an import.
 */
export async function searchCustomers(
  tenantId: string,
  q?: string,
  limit: number = CUSTOMER_PICKER_LIMIT,
): Promise<CustomerOption[]> {
  const db = getDb();

  const conds = [eq(customers.tenantId, tenantId)];
  const term = q?.trim();
  if (term) {
    const like = `%${term}%`;
    const searchConds = [
      ilike(customers.fullName, like),
      ilike(customers.phone, like),
      ilike(customers.clientCode, like),
    ];
    const phoneKey = normalizePhone(term);
    if (phoneKey) {
      searchConds.push(ilike(customers.phoneNormalized, `%${phoneKey}%`));
    }
    conds.push(or(...searchConds)!);
  }

  const rows = await db
    .select({
      id: customers.id,
      clientCode: customers.clientCode,
      fullName: customers.fullName,
      phone: customers.phone,
      tgUserId: customers.tgUserId,
    })
    .from(customers)
    .where(and(...conds))
    .orderBy(desc(customers.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    clientCode: r.clientCode,
    fullName: r.fullName,
    phone: r.phone,
    hasTelegram: r.tgUserId != null,
  }));
}

export type CreateCustomerResult =
  | { ok: true; customer: Customer }
  | { ok: false; error: 'DUPLICATE_PHONE'; existing: CustomerOption };

/**
 * Create a customer from the panel (SPEC §5.5) — the counterpart of the bot's
 * self-registration. `tg_user_id` stays NULL: the person has not opened the bot
 * yet, and the bot links this row to their Telegram account by phone on /start
 * (§7.12) instead of creating a second one.
 *
 * `client_code` is assigned exactly like the bot does (`nextClientCode`) and
 * retried on the unique-index collision a concurrent registration can cause.
 * A phone that already belongs to a customer is refused with that customer, so
 * the admin can open them instead of creating a duplicate.
 */
export async function createCustomer(args: {
  tenantId: string;
  codePrefix: string;
  phone: string | null;
  fullName: string | null;
}): Promise<CreateCustomerResult> {
  const db = getDb();
  const phoneNormalized = normalizePhone(args.phone);

  if (phoneNormalized) {
    const [dupe] = await db
      .select({
        id: customers.id,
        clientCode: customers.clientCode,
        fullName: customers.fullName,
        phone: customers.phone,
        tgUserId: customers.tgUserId,
      })
      .from(customers)
      .where(
        and(
          eq(customers.tenantId, args.tenantId),
          eq(customers.phoneNormalized, phoneNormalized),
        ),
      )
      .limit(1);
    if (dupe) {
      return {
        ok: false,
        error: 'DUPLICATE_PHONE',
        existing: {
          id: dupe.id,
          clientCode: dupe.clientCode,
          fullName: dupe.fullName,
          phone: dupe.phone,
          hasTelegram: dupe.tgUserId != null,
        },
      };
    }
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const codeRows = await db
      .select({ clientCode: customers.clientCode })
      .from(customers)
      .where(eq(customers.tenantId, args.tenantId));
    const clientCode = nextClientCode(
      args.codePrefix,
      codeRows.map((r) => r.clientCode),
    );

    try {
      const [row] = await db
        .insert(customers)
        .values({
          tenantId: args.tenantId,
          tgUserId: null,
          phone: args.phone,
          phoneNormalized,
          fullName: args.fullName,
          clientCode,
        })
        .returning();
      if (row) return { ok: true, customer: row };
    } catch (err) {
      // Only a client_code race is retryable here: tg_user_id is NULL (and
      // Postgres treats NULLs as distinct) and phone carries no unique index.
      if (!isUniqueViolation(err)) throw err;
    }
  }
  throw new Error('createCustomer: exhausted client_code retries');
}

export interface CustomerRow {
  id: string;
  clientCode: string;
  fullName: string | null;
  phone: string | null;
  trackCount: number;
  debtTiyin: number;
  // Not shown in the list UI — carried for the Excel export (AUDIT.md T2),
  // which reads the same rows so the file matches the screen exactly.
  lang: Lang;
  /** Whether the customer has ever opened the bot (SPEC §7.12 linking). */
  hasTelegram: boolean;
  createdAt: Date;
}

/**
 * Customers (optionally filtered) with their non-deleted track count and net
 * debt. Debt is computed via the shared `computeDebtTiyin` service (SPEC §7.5):
 * we pull the tenant's non-deleted tracks and payments once and group in memory
 * — fine at MVP scale and keeps the tested pure function as the single source
 * of the debt rule.
 */
export async function listCustomersWithDebt(
  tenantId: string,
  q?: string,
): Promise<CustomerRow[]> {
  const db = getDb();

  const conds = [eq(customers.tenantId, tenantId)];
  const term = q?.trim();
  if (term) {
    const like = `%${term}%`;
    conds.push(
      or(
        ilike(customers.fullName, like),
        ilike(customers.phone, like),
        ilike(customers.clientCode, like),
      )!,
    );
  }
  const custs = await db
    .select()
    .from(customers)
    .where(and(...conds))
    .orderBy(asc(customers.clientCode));

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
  const countByCustomer = new Map<string, number>();
  for (const t of trackRows) {
    if (!t.customerId) continue;
    const list = tracksByCustomer.get(t.customerId) ?? [];
    list.push({
      currentStatus: t.currentStatus,
      priceTiyin: t.priceTiyin,
      deletedAt: t.deletedAt,
    });
    tracksByCustomer.set(t.customerId, list);
    countByCustomer.set(t.customerId, (countByCustomer.get(t.customerId) ?? 0) + 1);
  }

  const paymentsByCustomer = new Map<string, { amountTiyin: number }[]>();
  for (const p of payRows) {
    const list = paymentsByCustomer.get(p.customerId) ?? [];
    list.push({ amountTiyin: p.amountTiyin });
    paymentsByCustomer.set(p.customerId, list);
  }

  return custs.map((c) => ({
    id: c.id,
    clientCode: c.clientCode,
    fullName: c.fullName,
    phone: c.phone,
    lang: c.lang,
    hasTelegram: c.tgUserId != null,
    createdAt: c.createdAt,
    trackCount: countByCustomer.get(c.id) ?? 0,
    debtTiyin: computeDebtTiyin(
      tracksByCustomer.get(c.id) ?? [],
      paymentsByCustomer.get(c.id) ?? [],
    ),
  }));
}

// --- Customer detail + payments (SPEC §5.5) ---------------------------------

export interface CustomerDetail {
  customer: Customer;
  tracks: Track[];
  payments: Payment[];
  debtTiyin: number;
}

/**
 * A customer with their non-deleted tracks, payment history (newest first) and
 * net debt (SPEC §7.5, via the shared `computeDebtTiyin`). Tenant-scoped.
 */
export async function getCustomerDetail(
  tenantId: string,
  customerId: string,
): Promise<CustomerDetail | null> {
  const db = getDb();

  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.tenantId, tenantId), eq(customers.id, customerId)))
    .limit(1);
  if (!customer) return null;

  const custTracks = await db
    .select()
    .from(tracks)
    .where(
      and(
        eq(tracks.tenantId, tenantId),
        eq(tracks.customerId, customerId),
        isNull(tracks.deletedAt),
      ),
    )
    .orderBy(desc(tracks.createdAt));

  const custPayments = await db
    .select()
    .from(payments)
    .where(
      and(eq(payments.tenantId, tenantId), eq(payments.customerId, customerId)),
    )
    .orderBy(desc(payments.createdAt));

  const debtTiyin = computeDebtTiyin(
    custTracks.map((t) => ({
      currentStatus: t.currentStatus,
      priceTiyin: t.priceTiyin,
      deletedAt: t.deletedAt,
    })),
    custPayments.map((p) => ({ amountTiyin: p.amountTiyin })),
  );

  return { customer, tracks: custTracks, payments: custPayments, debtTiyin };
}

/** Record a payment for a customer (amount in tiyin). Tenant-scoped (§5.5). */
export async function createPayment(args: {
  tenantId: string;
  customerId: string;
  amountTiyin: number;
  method: Payment['method'];
  note: string | null;
}): Promise<void> {
  await getDb().insert(payments).values({
    tenantId: args.tenantId,
    customerId: args.customerId,
    amountTiyin: args.amountTiyin,
    method: args.method,
    note: args.note,
  });
}

// --- Debtors (SPEC §5.6) ----------------------------------------------------

/** Customers with net debt > 0, sorted by debt descending (SPEC §5.6). */
export async function listDebtors(tenantId: string): Promise<CustomerRow[]> {
  const all = await listCustomersWithDebt(tenantId);
  return all
    .filter((c) => c.debtTiyin > 0)
    .sort((a, b) => b.debtTiyin - a.debtTiyin);
}

export interface DebtTotals {
  /** Customers whose net debt is > 0. */
  debtorCount: number;
  /** Sum of those positive nets, in tiyin (advances are NOT netted off). */
  debtTiyin: number;
}

/**
 * Debtor count + total, aggregated in Postgres (AUDIT.md T6).
 *
 * `listDebtors` answers the same question by pulling every track and every
 * payment of the tenant into Node and grouping there. That is fine for the
 * /debtors screen, which needs the rows anyway — but the layout badge runs on
 * EVERY page load and the dashboard repeated it a second time: at 50 000 tracks
 * that is seconds and hundreds of MB per click, for two numbers.
 *
 * The debt rule itself is not restated here: the `IN (…)` list comes from
 * `DEBT_OWED_STATUSES`, the same array `computeDebtTiyin` builds its set from,
 * and a test asserts the two agree for every status. The rest is a literal
 * translation of the function — soft-deleted tracks excluded (§7.8), NULL price
 * treated as 0, payments subtracted, `> 0` keeping only real debtors so an
 * advance never cancels out someone else's debt.
 */
export async function getDebtTotals(tenantId: string): Promise<DebtTotals> {
  const owedStatuses = sql.join(
    DEBT_OWED_STATUSES.map((s) => sql`${s}`),
    sql`, `,
  );

  // FULL JOIN, not a scan of `customers`: only customers who have at least one
  // owed track or one payment can have a non-zero net, so the two grouped sides
  // are all we need to touch. Both are tenant-scoped (CLAUDE.md rule 1) and hit
  // the T4 indexes (tracks_tenant_status_idx / payments_tenant_customer_idx).
  const rows = (await getDb().execute(sql`
    with owed as (
      select ${tracks.customerId} as customer_id,
             sum(coalesce(${tracks.priceTiyin}, 0)) as amount
        from ${tracks}
       where ${tracks.tenantId} = ${tenantId}
         and ${tracks.deletedAt} is null
         and ${tracks.customerId} is not null
         and ${tracks.currentStatus} in (${owedStatuses})
       group by ${tracks.customerId}
    ), paid as (
      select ${payments.customerId} as customer_id,
             sum(${payments.amountTiyin}) as amount
        from ${payments}
       where ${payments.tenantId} = ${tenantId}
       group by ${payments.customerId}
    )
    select count(*)::int as debtor_count,
           coalesce(sum(net), 0)::bigint as debt_tiyin
      from (
        select coalesce(owed.amount, 0) - coalesce(paid.amount, 0) as net
          from owed full join paid on paid.customer_id = owed.customer_id
      ) nets
     where net > 0
  `)) as unknown as Array<{ debtor_count: number; debt_tiyin: string }>;

  const row = rows[0];
  return {
    debtorCount: Number(row?.debtor_count ?? 0),
    debtTiyin: Number(row?.debt_tiyin ?? 0),
  };
}

/** Number of customers with net debt > 0 — the nav badge (AUDIT.md T6). */
export async function countDebtors(tenantId: string): Promise<number> {
  return (await getDebtTotals(tenantId)).debtorCount;
}

/**
 * Enqueue a manual debt reminder for a customer (SPEC §4.4). Fire-and-forget:
 * the bot's reminder worker re-checks the debt and sends, respecting rate
 * limits. Membership of the customer in this tenant is the caller's guarantee.
 */
export async function queueReminder(
  tenantId: string,
  customerId: string,
): Promise<void> {
  await enqueueReminder({ tenantId, customerId, reason: 'manual' });
}

/**
 * Drizzle schema for KargoTrack (PostgreSQL).
 *
 * Core tables from CLAUDE.md "Data Model" plus the SPEC.md 7.8 `deleted_at`
 * soft-delete extension on `tracks`.
 *
 * Conventions:
 * - Primary keys: uuid (gen_random_uuid, built into Postgres).
 * - Money: bigint tiyin (integer minor unit, never floats) — CLAUDE.md rule 6.
 * - Telegram user ids: bigint (they exceed int4).
 * - Timestamps: timestamptz stored in UTC — SPEC 7.9.
 * - Every domain table carries tenant_id — CLAUDE.md rule 1.
 */

import { relations } from 'drizzle-orm';
import {
  bigint,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// --- Enums -----------------------------------------------------------------

/** Fixed status pipeline (CLAUDE.md rule 7) in canonical order + side-states. */
export const trackStatus = pgEnum('track_status', [
  'CREATED',
  'CHINA_WAREHOUSE',
  'IN_TRANSIT',
  'TASHKENT_WAREHOUSE',
  'READY_FOR_PICKUP',
  'DELIVERED',
  'LOST',
  'RETURNED',
]);

export const adminRole = pgEnum('admin_role', ['owner', 'staff']);

export const paymentMethod = pgEnum('payment_method', [
  'cash',
  'click',
  'payme',
  'other',
]);

export const lang = pgEnum('lang', ['uz', 'ru']);

// --- Shared shapes ---------------------------------------------------------

/** Tenant-level configuration stored in `tenants.settings`. */
export type TenantSettings = {
  /** Telegram user ids allowed to use staff photo mode (SPEC 3.8). */
  staff_tg_ids: number[];
  /** Weekly auto-reminder config (SPEC 5.7 / 7.7). */
  reminders: {
    weekly_enabled: boolean;
    /** 1 = Monday … 7 = Sunday (ISO). */
    weekday: number;
    /** Hour of day in Asia/Tashkent, 0–23. */
    hour: number;
  };
};

// --- Tables ----------------------------------------------------------------

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  // Client-code prefix (2–4 latin letters, e.g. "DK"). client_code =
  // code_prefix + '-' + per-tenant sequence (SPEC 6, customers.client_code).
  codePrefix: text('code_prefix').notNull(),
  botToken: text('bot_token').notNull().unique(),
  botUsername: text('bot_username'),
  pricePerKgTiyin: bigint('price_per_kg_tiyin', { mode: 'number' }).notNull(),
  pickupAddress: text('pickup_address'),
  workingHours: text('working_hours'),
  contactPhone: text('contact_phone'),
  settings: jsonb('settings').$type<TenantSettings>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const adminUsers = pgTable('admin_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  phone: text('phone').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: adminRole('role').notNull().default('staff'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const customers = pgTable(
  'customers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    tgUserId: bigint('tg_user_id', { mode: 'number' }),
    phone: text('phone'),
    fullName: text('full_name'),
    clientCode: text('client_code').notNull(),
    lang: lang('lang').notNull().default('uz'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    // client_code is unique within a tenant.
    clientCodeUq: uniqueIndex('customers_tenant_client_code_uq').on(
      t.tenantId,
      t.clientCode,
    ),
    // A Telegram user maps to at most one customer per tenant.
    tgUserUq: uniqueIndex('customers_tenant_tg_user_uq').on(
      t.tenantId,
      t.tgUserId,
    ),
  }),
);

export const tracks = pgTable(
  'tracks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    // Nullable: codes can arrive before a customer claims them (CLAUDE.md).
    customerId: uuid('customer_id').references(() => customers.id, {
      onDelete: 'set null',
    }),
    codeNormalized: text('code_normalized').notNull(),
    codeOriginal: text('code_original').notNull(),
    currentStatus: trackStatus('current_status').notNull().default('CREATED'),
    weightGrams: integer('weight_grams'),
    priceTiyin: bigint('price_tiyin', { mode: 'number' }),
    photoPath: text('photo_path'),
    // SPEC 7.8 soft delete.
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    // CLAUDE.md: codes unique per tenant; collisions across tenants are fine.
    codeUq: uniqueIndex('tracks_tenant_code_uq').on(
      t.tenantId,
      t.codeNormalized,
    ),
    customerIdx: index('tracks_customer_idx').on(t.customerId),
  }),
);

export const trackEvents = pgTable('track_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  trackId: uuid('track_id')
    .notNull()
    .references(() => tracks.id, { onDelete: 'cascade' }),
  status: trackStatus('status').notNull(),
  meta: jsonb('meta'),
  // Free-form actor: 'system', an admin_user id, or a telegram id.
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customers.id, { onDelete: 'cascade' }),
  amountTiyin: bigint('amount_tiyin', { mode: 'number' }).notNull(),
  method: paymentMethod('method').notNull().default('cash'),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- Relations (for typed relational queries) ------------------------------

export const tenantsRelations = relations(tenants, ({ many }) => ({
  adminUsers: many(adminUsers),
  customers: many(customers),
  tracks: many(tracks),
  payments: many(payments),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [customers.tenantId],
    references: [tenants.id],
  }),
  tracks: many(tracks),
  payments: many(payments),
}));

export const tracksRelations = relations(tracks, ({ one, many }) => ({
  tenant: one(tenants, { fields: [tracks.tenantId], references: [tenants.id] }),
  customer: one(customers, {
    fields: [tracks.customerId],
    references: [customers.id],
  }),
  events: many(trackEvents),
}));

export const trackEventsRelations = relations(trackEvents, ({ one }) => ({
  track: one(tracks, {
    fields: [trackEvents.trackId],
    references: [tracks.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [payments.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [payments.customerId],
    references: [customers.id],
  }),
}));

// --- Inferred types --------------------------------------------------------

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type AdminUser = typeof adminUsers.$inferSelect;
export type NewAdminUser = typeof adminUsers.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Track = typeof tracks.$inferSelect;
export type NewTrack = typeof tracks.$inferInsert;
export type TrackEvent = typeof trackEvents.$inferSelect;
export type NewTrackEvent = typeof trackEvents.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

export type TrackStatus = (typeof trackStatus.enumValues)[number];

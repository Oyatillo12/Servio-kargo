/**
 * Demo seed for KargoTrack.
 *
 * Creates one tenant (DemoKargo), one owner admin, 5 customers, 30 tracks
 * spread across every status with realistic timestamps over the last 20 days,
 * a full track_events audit trail per track, and a few payments so debt is
 * non-trivial. Prints row counts at the end.
 *
 * Run: pnpm --filter @kargotrack/db run db:seed
 * (loads packages/db/.env via `tsx --env-file`).
 */

import { hash } from '@node-rs/argon2';
import { sql } from 'drizzle-orm';

import { getDb } from './index';
import {
  adminUsers,
  batches,
  customers,
  payments,
  tariffs,
  tenants,
  trackEvents,
  tracks,
  type TrackStatus,
} from './schema';

const db = getDb();

// --- Deterministic PRNG so re-seeding gives stable-ish data ---------------
let seedState = 1337;
function rand(): number {
  // xorshift32
  seedState ^= seedState << 13;
  seedState ^= seedState >>> 17;
  seedState ^= seedState << 5;
  return ((seedState >>> 0) % 100000) / 100000;
}
function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}
function pick<T>(arr: readonly T[]): T {
  return arr[randInt(0, arr.length - 1)]!;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.now();
/** A timestamp `daysAgo` days back (with a random intraday offset). */
function daysAgo(days: number): Date {
  return new Date(NOW - days * DAY_MS - randInt(0, DAY_MS - 1));
}

// Canonical pipeline order (matches the enum). Side-states handled separately.
const PIPELINE: TrackStatus[] = [
  'CREATED',
  'CHINA_WAREHOUSE',
  'IN_TRANSIT',
  'TASHKENT_WAREHOUSE',
  'READY_FOR_PICKUP',
  'DELIVERED',
];

const PRICE_PER_KG_TIYIN = 5_500_000; // 55 000 so'm/kg

/** SPEC 7.4: price_tiyin = round(weight_grams * price_per_kg_tiyin / 1000). */
function priceForGrams(grams: number): number {
  return Math.round((grams * PRICE_PER_KG_TIYIN) / 1000);
}

function makeCode(i: number): string {
  const prefixes = ['YT', 'SF', 'JD', 'CN', 'GZ'];
  const prefix = prefixes[i % prefixes.length]!;
  const digits = String(1_000_000_000 + randInt(0, 899_999_999));
  return `${prefix}${digits}`;
}

async function main() {
  console.log('Seeding DemoKargo…');

  // Clean slate (FK-safe order). RESTART IDENTITY not needed (uuid PKs).
  await db.execute(
    sql`TRUNCATE TABLE ${payments}, ${trackEvents}, ${tracks}, ${batches}, ${tariffs}, ${customers}, ${adminUsers}, ${tenants} RESTART IDENTITY CASCADE`,
  );

  // --- Tenant --------------------------------------------------------------
  const [tenant] = await db
    .insert(tenants)
    .values({
      name: 'KargoTrack test',
      codePrefix: 'DK',
      botToken: '8872793732:AAEp7wq-ayj5nT_uinYQovAjETp2QoLfw1o',
      botUsername: 'kargo_track_test_bot',
      currency: 'UZS',
      usdRateTiyin: null,
      pickupAddress: "Toshkent sh., Chilonzor t., Bunyodkor ko'chasi 1",
      workingHours: 'Dushanba–Shanba, 09:00–18:00',
      contactPhone: '+998901112233',
      settings: {
        staff_tg_ids: [111111111, 222222222],
        reminders: { weekly_enabled: true, weekday: 1, hour: 10 },
      },
      createdAt: daysAgo(20),
    })
    .returning();
  if (!tenant) throw new Error('failed to insert tenant');

  // --- Tariffs (one active default) ----------------------------------------
  const [defaultTariff] = await db
    .insert(tariffs)
    .values({
      tenantId: tenant.id,
      name: 'Asosiy',
      pricePerKgMinor: PRICE_PER_KG_TIYIN,
      isDefault: true,
      active: true,
    })
    .returning();
  if (!defaultTariff) throw new Error('failed to insert tariff');

  // --- Batches (Reyslar) ---------------------------------------------------
  const isoDaysFromNow = (days: number) =>
    new Date(NOW + days * DAY_MS).toISOString().slice(0, 10);
  const insertedBatches = await db
    .insert(batches)
    .values([
      {
        tenantId: tenant.id,
        name: 'AVIA-01',
        transport: 'avia',
        etaDate: isoDaysFromNow(3),
        status: 'IN_TRANSIT',
        createdAt: daysAgo(6),
      },
      {
        tenantId: tenant.id,
        name: 'AVTO-01',
        transport: 'avto',
        etaDate: isoDaysFromNow(10),
        status: 'CHINA_WAREHOUSE',
        createdAt: daysAgo(3),
      },
    ])
    .returning();

  // --- Admin (owner) -------------------------------------------------------
  const passwordHash = await hash('demo123');
  await db.insert(adminUsers).values({
    tenantId: tenant.id,
    phone: '+998901234567',
    passwordHash,
    role: 'owner',
    createdAt: daysAgo(20),
  });

  // --- Customers -----------------------------------------------------------
  const customerSeeds = [
    {
      fullName: 'Alisher Karimov',
      phone: '+998901000001',
      lang: 'uz' as const,
    },
    {
      fullName: 'Dilnoza Yusupova',
      phone: '+998901000002',
      lang: 'uz' as const,
    },
    { fullName: 'Sardor Rahimov', phone: '+998901000003', lang: 'uz' as const },
    { fullName: 'Elena Petrova', phone: '+998901000004', lang: 'ru' as const },
    { fullName: 'Ivan Sidorov', phone: '+998901000005', lang: 'ru' as const },
  ];
  const insertedCustomers = await db
    .insert(customers)
    .values(
      customerSeeds.map((c, i) => ({
        tenantId: tenant.id,
        tgUserId: 500_000_000 + i,
        phone: c.phone,
        fullName: c.fullName,
        clientCode: `DK-${1001 + i}`,
        lang: c.lang,
        createdAt: daysAgo(20 - i),
      })),
    )
    .returning();

  // --- Tracks + events + (implicit) debt -----------------------------------
  // Distribute 30 tracks across all 8 statuses. Ensure every status appears.
  const statusPlan: TrackStatus[] = [];
  const allStatuses: TrackStatus[] = [...PIPELINE, 'LOST', 'RETURNED'];
  for (const s of allStatuses) statusPlan.push(s); // 8 guaranteed
  while (statusPlan.length < 30) statusPlan.push(pick(allStatuses)); // fill to 30

  let eventCount = 0;
  for (let i = 0; i < statusPlan.length; i++) {
    const status = statusPlan[i]!;
    const createdAt = daysAgo(randInt(1, 20));

    // ~20% of tracks are unclaimed (customer_id null) — CLAUDE.md.
    const claimed = rand() > 0.2;
    const customerId = claimed ? pick(insertedCustomers).id : null;

    // Weight/price known once weighed at Tashkent onward.
    const weighed =
      status === 'TASHKENT_WAREHOUSE' ||
      status === 'READY_FOR_PICKUP' ||
      status === 'DELIVERED';
    const weightGrams = weighed ? randInt(300, 25_000) : null;
    const priceTiyin = weightGrams != null ? priceForGrams(weightGrams) : null;

    // Assign in-transit / china-warehouse tracks to the matching demo batch.
    const batchId =
      status === 'IN_TRANSIT'
        ? (insertedBatches[0]?.id ?? null)
        : status === 'CHINA_WAREHOUSE'
          ? (insertedBatches[1]?.id ?? null)
          : null;

    const code = makeCode(i);
    const [track] = await db
      .insert(tracks)
      .values({
        tenantId: tenant.id,
        customerId,
        tariffId: weightGrams != null ? defaultTariff.id : null,
        batchId,
        codeNormalized: code,
        codeOriginal: code,
        currentStatus: status,
        weightGrams,
        priceTiyin,
        photoPath:
          status === 'READY_FOR_PICKUP' && rand() > 0.5
            ? `demo/${code}.jpg`
            : null,
        createdAt,
      })
      .returning();
    if (!track) throw new Error('failed to insert track');

    // Build the event trail. For pipeline statuses, walk from CREATED up to it.
    // For side-states (LOST/RETURNED), walk the pipeline partway then branch.
    const trail: TrackStatus[] = [];
    const pipeIdx = PIPELINE.indexOf(status);
    if (pipeIdx >= 0) {
      for (let j = 0; j <= pipeIdx; j++) trail.push(PIPELINE[j]!);
    } else {
      // side-state: got somewhere in transit, then LOST/RETURNED
      const branchAt = randInt(1, 3); // CHINA_WAREHOUSE..TASHKENT_WAREHOUSE
      for (let j = 0; j <= branchAt; j++) trail.push(PIPELINE[j]!);
      trail.push(status);
    }

    // Timestamps ascending from createdAt to now.
    const span = Math.max(1, NOW - createdAt.getTime());
    for (let k = 0; k < trail.length; k++) {
      const at = new Date(
        createdAt.getTime() + Math.round((span * k) / trail.length),
      );
      await db.insert(trackEvents).values({
        trackId: track.id,
        status: trail[k]!,
        meta: k === 0 ? { source: 'seed' } : null,
        createdBy: 'system',
        createdAt: at,
      });
      eventCount++;
    }
  }

  // --- Payments (partial, so some customers still owe) ---------------------
  const paymentMethods = ['cash', 'click', 'payme'] as const;
  let paymentCount = 0;
  for (const c of insertedCustomers.slice(0, 3)) {
    const n = randInt(1, 2);
    for (let p = 0; p < n; p++) {
      await db.insert(payments).values({
        tenantId: tenant.id,
        customerId: c.id,
        amountTiyin: randInt(1, 10) * 5_000_000, // 50k–500k so'm
        method: pick(paymentMethods),
        note: 'Demo to‘lov',
        createdAt: daysAgo(randInt(1, 15)),
      });
      paymentCount++;
    }
  }

  // --- Report --------------------------------------------------------------
  const counts = (await db.execute(sql`
    SELECT 'tenants' AS table, count(*)::int AS n FROM ${tenants}
    UNION ALL SELECT 'admin_users', count(*)::int FROM ${adminUsers}
    UNION ALL SELECT 'customers', count(*)::int FROM ${customers}
    UNION ALL SELECT 'tracks', count(*)::int FROM ${tracks}
    UNION ALL SELECT 'track_events', count(*)::int FROM ${trackEvents}
    UNION ALL SELECT 'payments', count(*)::int FROM ${payments}
  `)) as unknown as Array<{ table: string; n: number }>;

  console.log('\nSeed complete. Row counts:');
  for (const row of counts) {
    console.log(`  ${String(row.table).padEnd(13)} ${row.n}`);
  }
  console.log(
    `\n(track_events inserted this run: ${eventCount}, payments: ${paymentCount})`,
  );
}

main()
  .then(async () => {
    await closeDb();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('Seed failed:', err);
    await closeDb();
    process.exit(1);
  });

async function closeDb() {
  // postgres-js keeps the pool open; end it so the process can exit cleanly.
  const anyDb = db as unknown as {
    $client?: { end?: (opts?: { timeout?: number }) => Promise<void> };
  };
  if (anyDb.$client?.end) await anyDb.$client.end({ timeout: 5 });
}

/**
 * Demo importer — sales tool (packages/db/scripts).
 *
 * Reads a .txt file of raw posts copied from a cargo company's PUBLIC Telegram
 * channel (messy: headers, dates, emoji, list markers, mixed code formats),
 * extracts every plausible track code, then creates a throwaway DEMO tenant
 * with that company's name and fills it with realistic data: the codes spread
 * across the status pipeline, each with a track_events audit trail whose
 * timestamps land in the last 30 days. Prints a summary you can eyeball before
 * the meeting.
 *
 * Unlike src/seed.ts this NEVER truncates — it adds one more tenant alongside
 * whatever already exists (multi-tenant, CLAUDE.md rule 1).
 *
 * Run:
 *   pnpm --filter @kargotrack/db run db:demo-import -- <channel.txt> "<Company Name>"
 * e.g.
 *   pnpm --filter @kargotrack/db run db:demo-import -- ./yiwu-cargo.txt "Yiwu Express"
 */

import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

import { hash } from '@node-rs/argon2';
import {
  extractTrackCodesFromChannel,
  formatDate,
  formatSom,
  nextClientCode,
  priceForGrams,
  STATUS_META,
  type TrackStatus,
} from '@kargotrack/shared';

import { getDb } from '../src/index';
import {
  adminUsers,
  customers,
  payments,
  tariffs,
  tenants,
  trackEvents,
  tracks,
} from '../src/schema';

// --- CLI args --------------------------------------------------------------
// First token = file, rest = company name. pnpm can forward the `--` separator
// itself as a literal arg, so drop any bare `--` tokens defensively.
const argv = process.argv.slice(2).filter((a) => a !== '--');
const filePath = argv[0];
const companyName = argv.slice(1).join(' ').trim();

function usageAndExit(msg: string): never {
  console.error(`\n  ${msg}\n`);
  console.error(
    '  Usage: pnpm --filter @kargotrack/db run db:demo-import -- <channel.txt> "<Company Name>"\n',
  );
  process.exit(1);
}

if (!filePath) usageAndExit('Missing input file.');
if (!companyName) usageAndExit('Missing company name.');

// pnpm runs this with cwd = packages/db; INIT_CWD is where the user invoked it,
// so relative paths resolve from there as the user expects.
const resolvedPath = isAbsolute(filePath)
  ? filePath
  : resolve(process.env.INIT_CWD ?? process.cwd(), filePath);

let rawText: string;
try {
  rawText = readFileSync(resolvedPath, 'utf8');
} catch (err) {
  usageAndExit(
    `Could not read file "${resolvedPath}": ${(err as Error).message}`,
  );
}

// --- Deterministic PRNG seeded by the company name -------------------------
// Same channel + name → same generated layout, so a demo is reproducible.
function seedFrom(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) || 1;
}
let seedState = seedFrom(companyName);
function rand(): number {
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
const WINDOW_DAYS = 30; // codes + events spread across the last 30 days
function daysAgo(days: number): Date {
  return new Date(NOW - days * DAY_MS - randInt(0, DAY_MS - 1));
}

// --- Demo data shape -------------------------------------------------------
const PIPELINE: TrackStatus[] = [
  'CREATED',
  'CHINA_WAREHOUSE',
  'IN_TRANSIT',
  'TASHKENT_WAREHOUSE',
  'READY_FOR_PICKUP',
  'DELIVERED',
];

/**
 * Realistic "last month of a channel" mix: most parcels already delivered, a
 * healthy tail still moving. Weights are relative. LOST/RETURNED are rare.
 */
const STATUS_WEIGHTS: Array<[TrackStatus, number]> = [
  ['DELIVERED', 34],
  ['READY_FOR_PICKUP', 15],
  ['TASHKENT_WAREHOUSE', 12],
  ['IN_TRANSIT', 15],
  ['CHINA_WAREHOUSE', 12],
  ['CREATED', 6],
  ['RETURNED', 4],
  ['LOST', 2],
];
const WEIGHTED_POOL: TrackStatus[] = STATUS_WEIGHTS.flatMap(([s, w]) =>
  Array.from({ length: w }, () => s),
);

const PRICE_PER_KG_TIYIN = 5_500_000; // 55 000 so'm/kg

const CUSTOMER_NAMES = [
  'Alisher Karimov',
  'Dilnoza Yusupova',
  'Sardor Rahimov',
  'Nigora Ahmedova',
  'Bekzod Toshmatov',
  'Malika Saidova',
  'Jasur Qodirov',
  'Elena Petrova',
  'Oybek Nazarov',
  'Ivan Sidorov',
];

/** 2-letter client-code prefix from the company name (fallback "DM"). */
function derivePrefix(name: string): string {
  const letters = name.toUpperCase().replace(/[^A-Z]/g, '');
  return letters.length >= 2 ? letters.slice(0, 2) : 'DM';
}

const db = getDb();

async function main(): Promise<void> {
  // --- 1. Extract codes ----------------------------------------------------
  const parsed = extractTrackCodesFromChannel(rawText);
  if (parsed.codes.length === 0) {
    usageAndExit(
      'No track codes found in that file — nothing to import. ' +
        `(${parsed.linesTotal} lines scanned, all skipped.)`,
    );
  }

  console.log(
    `\nParsed "${resolvedPath}": ${parsed.codes.length} codes, ` +
      `${parsed.linesSkipped} lines skipped, ` +
      `${parsed.duplicateCount} duplicates dropped.`,
  );

  // --- 2. Demo tenant + default tariff + owner login -----------------------
  const prefix = derivePrefix(companyName);
  const [tenant] = await db
    .insert(tenants)
    .values({
      name: companyName,
      codePrefix: prefix,
      // No real bot — a unique placeholder keeps the NOT NULL/unique constraint happy.
      botToken: `demo:${randomUUID()}`,
      botUsername: null,
      currency: 'UZS',
      usdRateTiyin: null,
      pickupAddress: "Toshkent sh., Chilonzor t., Bunyodkor ko'chasi 1",
      workingHours: 'Dushanba–Shanba, 09:00–18:00',
      contactPhone: '+998 90 000 00 00',
      settings: {
        reminders: { weekly_enabled: false, weekday: 1, hour: 10 },
        demo: true,
      },
      createdAt: daysAgo(WINDOW_DAYS),
    })
    .returning();
  if (!tenant) throw new Error('failed to insert demo tenant');

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
  if (!defaultTariff) throw new Error('failed to insert default tariff');

  const demoPhone = `+99890${String(randInt(1_000_000, 9_999_999))}`;
  const demoPassword = 'demo1234';
  await db.insert(adminUsers).values({
    tenantId: tenant.id,
    phone: demoPhone,
    passwordHash: await hash(demoPassword),
    role: 'owner',
    createdAt: daysAgo(WINDOW_DAYS),
  });

  // --- 3. Customers --------------------------------------------------------
  const customerCount = Math.min(
    CUSTOMER_NAMES.length,
    Math.max(3, Math.ceil(parsed.codes.length / 5)),
  );
  const insertedCustomers = await db
    .insert(customers)
    .values(
      Array.from({ length: customerCount }, (_, i) => ({
        tenantId: tenant.id,
        tgUserId: null,
        phone: `+99890${String(1_000_000 + i)}`,
        fullName: CUSTOMER_NAMES[i]!,
        clientCode: nextClientCode(
          prefix,
          Array.from({ length: i }, (_, k) => `${prefix}-${1001 + k}`),
        ),
        lang: (i % 4 === 3 ? 'ru' : 'uz') as 'uz' | 'ru',
        createdAt: daysAgo(WINDOW_DAYS - (i % WINDOW_DAYS)),
      })),
    )
    .returning();

  // --- 4. Tracks + events --------------------------------------------------
  const statusBreakdown = new Map<TrackStatus, number>();
  const owedByCustomer = new Map<string, number>();
  let earliest = NOW;
  let latest = 0;
  let eventCount = 0;

  // Guarantee variety: seed one of each status first (bounded by code count),
  // then fill the rest from the weighted pool.
  const statusPlan: TrackStatus[] = [];
  for (const s of [...PIPELINE, 'LOST' as const, 'RETURNED' as const]) {
    if (statusPlan.length < parsed.codes.length) statusPlan.push(s);
  }
  while (statusPlan.length < parsed.codes.length) {
    statusPlan.push(pick(WEIGHTED_POOL));
  }

  for (let i = 0; i < parsed.codes.length; i++) {
    const code = parsed.codes[i]!;
    const status = statusPlan[i]!;
    statusBreakdown.set(status, (statusBreakdown.get(status) ?? 0) + 1);

    // Older parcels for later pipeline stages; everything within the window.
    const pipeIdx = PIPELINE.indexOf(status);
    const minAge = pipeIdx >= 0 ? Math.min(pipeIdx * 4, WINDOW_DAYS - 1) : 6;
    const createdAt = daysAgo(randInt(minAge + 1, WINDOW_DAYS));

    // ~15% of codes are unclaimed (arrived before a customer registered them).
    const claimed = rand() > 0.15 && insertedCustomers.length > 0;
    const customer = claimed ? pick(insertedCustomers) : null;

    // Weighed from Tashkent onward → weight + som price known.
    const weighed =
      status === 'TASHKENT_WAREHOUSE' ||
      status === 'READY_FOR_PICKUP' ||
      status === 'DELIVERED';
    const weightGrams = weighed ? randInt(300, 25_000) : null;
    const priceTiyin =
      weightGrams != null ? priceForGrams(weightGrams, PRICE_PER_KG_TIYIN) : null;

    const [track] = await db
      .insert(tracks)
      .values({
        tenantId: tenant.id,
        customerId: customer?.id ?? null,
        tariffId: weightGrams != null ? defaultTariff.id : null,
        codeNormalized: code.normalized,
        codeOriginal: code.original,
        currentStatus: status,
        weightGrams,
        priceTiyin,
        createdAt,
      })
      .returning();
    if (!track) throw new Error('failed to insert track');

    // Debt accrues on READY_FOR_PICKUP + DELIVERED (SPEC §7.4 debt rule).
    if (
      customer &&
      priceTiyin != null &&
      (status === 'READY_FOR_PICKUP' || status === 'DELIVERED')
    ) {
      owedByCustomer.set(
        customer.id,
        (owedByCustomer.get(customer.id) ?? 0) + priceTiyin,
      );
    }

    // Event trail: walk the pipeline up to `status`; side-states branch partway.
    const trail: TrackStatus[] = [];
    if (pipeIdx >= 0) {
      for (let j = 0; j <= pipeIdx; j++) trail.push(PIPELINE[j]!);
    } else {
      const branchAt = randInt(1, 3);
      for (let j = 0; j <= branchAt; j++) trail.push(PIPELINE[j]!);
      trail.push(status);
    }

    const span = Math.max(1, NOW - createdAt.getTime());
    for (let k = 0; k < trail.length; k++) {
      const at = new Date(
        createdAt.getTime() + Math.round((span * k) / trail.length),
      );
      earliest = Math.min(earliest, at.getTime());
      latest = Math.max(latest, at.getTime());
      await db.insert(trackEvents).values({
        trackId: track.id,
        status: trail[k]!,
        meta: k === 0 ? { source: 'demo-import' } : null,
        createdBy: 'system',
        createdAt: at,
      });
      eventCount++;
    }
  }

  // --- 5. Partial payments so the debt screen looks real -------------------
  const methods = ['cash', 'click', 'payme'] as const;
  let paymentCount = 0;
  for (const [customerId, owed] of owedByCustomer) {
    if (owed <= 0 || rand() > 0.6) continue; // ~60% have paid something
    const paid = Math.round(owed * (0.3 + rand() * 0.6)); // 30–90% of debt
    await db.insert(payments).values({
      tenantId: tenant.id,
      customerId,
      amountTiyin: paid,
      method: pick(methods),
      note: 'Demo import',
      createdAt: daysAgo(randInt(1, WINDOW_DAYS - 1)),
    });
    paymentCount++;
  }

  // --- 6. Summary ----------------------------------------------------------
  const line = '─'.repeat(48);
  console.log(`\n${line}`);
  console.log(`  DEMO READY — ${companyName}`);
  console.log(line);
  console.log(`  Codes imported : ${parsed.codes.length}`);
  console.log(
    `  Date range     : ${formatDate(new Date(earliest))} → ${formatDate(
      new Date(latest),
    )}`,
  );
  console.log(`  Customers      : ${insertedCustomers.length}`);
  console.log(`  Track events   : ${eventCount}`);
  console.log(`  Payments       : ${paymentCount}`);
  console.log(`\n  Status breakdown:`);
  for (const s of [...PIPELINE, 'LOST' as const, 'RETURNED' as const]) {
    const n = statusBreakdown.get(s) ?? 0;
    if (n === 0) continue;
    const meta = STATUS_META[s];
    console.log(`    ${meta.emoji}  ${meta.uz.padEnd(22)} ${n}`);
  }
  const totalOwed = [...owedByCustomer.values()].reduce((a, b) => a + b, 0);
  console.log(`\n  Total billed   : ${formatSom(totalOwed)} so'm (before payments)`);
  console.log(`\n  Panel login — phone: ${demoPhone}   password: ${demoPassword}`);
  console.log(`  Tenant id      : ${tenant.id}`);
  if (parsed.errorLines > 0) {
    console.log(`\n  (note: ${parsed.errorLines} lines errored during parse and were skipped)`);
  }
  console.log(`${line}\n`);
}

main()
  .then(async () => {
    await closeDb();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('Demo import failed:', err);
    await closeDb();
    process.exit(1);
  });

async function closeDb(): Promise<void> {
  const anyDb = db as unknown as {
    $client?: { end?: (opts?: { timeout?: number }) => Promise<void> };
  };
  if (anyDb.$client?.end) await anyDb.$client.end({ timeout: 5 });
}

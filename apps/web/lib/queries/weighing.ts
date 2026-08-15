/**
 * The /weigh console's data layer (tasks.md W1/W2, SPEC §3.8, §7.4).
 *
 * Telegram is blocked in China — which is exactly where parcels are weighed — so
 * the panel is the primary weighing surface and the bot's staff mode is the
 * fallback. What weighing DOES is decided by the shared `planWeighEntry`, the
 * same call `apps/bot/src/queries/weighing.ts` makes; this module only executes
 * the plan and shapes the row the console shows back.
 *
 * Every query is tenant-scoped (CLAUDE.md rule 1).
 */

import 'server-only';

import { and, desc, eq, gte, isNull, lt, sql } from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import { enqueueNotification } from '@kargotrack/db/queue';
import {
  customers,
  trackEvents,
  trackPhotos,
  tracks,
} from '@kargotrack/db/schema';
import {
  clientCodeKey,
  periodRange,
  planWeighEntry,
  type Currency,
  type MarkaOutcomeKind,
  type WeighEffects,
  type WeighRejection,
} from '@kargotrack/shared';

import { isUniqueViolation } from './internal';
import { getDefaultTariff } from './tariffs';

/**
 * `track_events.meta.source` for a weighing done on the console — distinct from
 * the bot's `bot-staff` and the panel's ordinary `panel`, so today's list can be
 * rebuilt after a reload without inventing a `weighed_at` column.
 */
export const WEIGH_EVENT_SOURCE = 'panel-weigh';

/** How many of today's entries the console lists. A shift rarely exceeds this. */
const TODAY_LIMIT = 60;

/** A customer as the console names them: the marka, plus a name if we have one. */
export interface WeighOwner {
  clientCode: string;
  fullName: string | null;
}

/** One line of the console's day list. */
export interface WeighedRow {
  trackId: string;
  code: string;
  weightGrams: number;
  priceTiyin: number;
  /** The code was unknown and this parcel was created by the weighing. */
  created: boolean;
  /** The parcel moved into CHINA_WAREHOUSE (an audit event was written). */
  advanced: boolean;
  /** A §4.2 arrival message was queued for the owner. */
  notified: boolean;
  /** Owner after the write, or null when the parcel is still unclaimed. */
  owner: WeighOwner | null;
  /** What the typed marka did — drives the row's warning, if any. */
  marka: MarkaOutcomeKind;
  /** A warehouse photo is on file (from here or the bot) — W4. */
  hasPhoto: boolean;
}

export type WeighResult =
  | { ok: true; row: WeighedRow }
  | { ok: false; reason: WeighRejection };

/** `DK-1042` and `dk1042` are the same marka — compare both sides stripped. */
const clientCodeExpr = sql<string>`upper(regexp_replace(${customers.clientCode}, '[^A-Za-z0-9]', '', 'g'))`;

/** "This parcel has at least one photo" (SPEC §7.14) — drives the W4 icon. */
const hasPhotoExpr = sql<boolean>`exists (select 1 from ${trackPhotos} where ${trackPhotos.trackId} = ${tracks.id})`;

/** Resolve a typed marka to one of this tenant's customers, or null. */
async function findCustomerByMarka(
  tenantId: string,
  raw: string,
): Promise<{ id: string; clientCode: string; fullName: string | null } | null> {
  const key = clientCodeKey(raw);
  if (key === '') return null;

  const [row] = await getDb()
    .select({
      id: customers.id,
      clientCode: customers.clientCode,
      fullName: customers.fullName,
    })
    .from(customers)
    .where(and(eq(customers.tenantId, tenantId), eq(clientCodeExpr, key)))
    .limit(1);
  return row ?? null;
}

/** The (non-deleted) track this code already resolves to, or undefined. */
async function findTrackByCode(tenantId: string, codeNormalized: string) {
  const [row] = await getDb()
    .select({
      id: tracks.id,
      codeOriginal: tracks.codeOriginal,
      currentStatus: tracks.currentStatus,
      customerId: tracks.customerId,
      hasPhoto: hasPhotoExpr,
    })
    .from(tracks)
    .where(
      and(
        eq(tracks.tenantId, tenantId),
        eq(tracks.codeNormalized, codeNormalized),
        isNull(tracks.deletedAt),
      ),
    )
    .limit(1);
  return row;
}

/** Look up one customer for display, by id. Tenant-scoped. */
async function ownerById(
  tenantId: string,
  customerId: string | null,
): Promise<WeighOwner | null> {
  if (customerId == null) return null;
  const [row] = await getDb()
    .select({ clientCode: customers.clientCode, fullName: customers.fullName })
    .from(customers)
    .where(and(eq(customers.tenantId, tenantId), eq(customers.id, customerId)))
    .limit(1);
  return row ?? null;
}

/**
 * Weigh one parcel from the console.
 *
 * Sets weight + auto price, advances a CREATED parcel to CHINA_WAREHOUSE with an
 * audit event and an owner notification, creates an unknown code unattached, and
 * — W2's addition — attaches the customer the marka names when the parcel has no
 * owner yet. A marka pointing at somebody else never moves the parcel: the
 * weight is written, the owner is left alone and the caller is told (`conflict`).
 *
 * The status event and the ownership event are written as two rows on purpose:
 * the track timeline reads `meta.action` to label an ownership change, so
 * folding them together would hide the arrival behind the attach.
 */
export async function applyPanelWeighing(args: {
  tenantId: string;
  currency: Currency;
  usdRateTiyin: number | null;
  codeNormalized: string;
  codeOriginal: string;
  weightGrams: number;
  /** The marka exactly as typed, or null when the field was left empty. */
  marka: string | null;
  /** `admin_users.id` — the console is always a signed-in employee. */
  createdBy: string;
}): Promise<WeighResult> {
  const { tenantId } = args;

  const [tariff, markaCustomer] = await Promise.all([
    getDefaultTariff(tenantId),
    args.marka ? findCustomerByMarka(tenantId, args.marka) : null,
  ]);

  const planFor = (track: Awaited<ReturnType<typeof findTrackByCode>>) =>
    planWeighEntry({
      currency: args.currency,
      usdRateTiyin: args.usdRateTiyin,
      tariff: tariff
        ? { id: tariff.id, pricePerKgMinor: tariff.pricePerKgMinor }
        : null,
      weightGrams: args.weightGrams,
      track: track
        ? { currentStatus: track.currentStatus, customerId: track.customerId }
        : null,
      markaTyped: args.marka != null,
      markaCustomerId: markaCustomer?.id ?? null,
      markaRaw: args.marka,
    });

  const existing = await findTrackByCode(tenantId, args.codeNormalized);
  const plan = planFor(existing);
  if (!plan.ok) return { ok: false, reason: plan.reason };

  if (existing) {
    return {
      ok: true,
      row: await weighExisting(args, existing, plan),
    };
  }

  const created = await createWeighed(args, plan);
  if (created) return { ok: true, row: created };

  // Lost the race against a concurrent insert of the same code (the bot, an
  // import, another scanner) — the code exists now, so weigh it instead.
  const raced = await findTrackByCode(tenantId, args.codeNormalized);
  if (!raced) throw new Error('applyPanelWeighing: insert lost but code gone');
  const racedPlan = planFor(raced);
  if (!racedPlan.ok) return { ok: false, reason: racedPlan.reason };
  return { ok: true, row: await weighExisting(args, raced, racedPlan) };
}

type WeighArgs = Parameters<typeof applyPanelWeighing>[0];

/** Insert an unknown code as a parcel already at the China warehouse. */
async function createWeighed(
  args: WeighArgs,
  plan: WeighEffects,
): Promise<WeighedRow | null> {
  const db = getDb();

  let trackId: string;
  try {
    const [track] = await db
      .insert(tracks)
      .values({
        tenantId: args.tenantId,
        codeNormalized: args.codeNormalized,
        codeOriginal: args.codeOriginal,
        customerId: plan.attachCustomerId,
        currentStatus: plan.newStatus,
        marka: plan.storeMarka,
        ...plan.pricing,
      })
      .returning({ id: tracks.id });
    if (!track) return null;
    trackId = track.id;
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    return null;
  }

  // A brand-new parcel needs no separate `attach` event: creation already says
  // whose it is, and `meta.marka` records how that was decided.
  await db.insert(trackEvents).values({
    trackId,
    status: plan.newStatus,
    meta: {
      source: WEIGH_EVENT_SOURCE,
      created: true,
      marka: plan.marka.kind,
      // §7.13: the typed string itself — the column holds only the LATEST
      // marking, the append-only log keeps every one that was ever weighed in.
      ...(plan.storeMarka != null ? { markaRaw: plan.storeMarka } : {}),
    },
    createdBy: args.createdBy,
  });

  await notify(args.tenantId, trackId, plan);

  return {
    trackId,
    code: args.codeOriginal,
    weightGrams: plan.pricing.weightGrams,
    priceTiyin: plan.pricing.priceTiyin,
    created: true,
    advanced: plan.willEvent,
    notified: plan.willNotify,
    owner: await ownerById(args.tenantId, plan.attachCustomerId),
    marka: plan.marka.kind,
    hasPhoto: false,
  };
}

/** Write weight/price (and maybe an owner) onto a parcel we already knew. */
async function weighExisting(
  args: WeighArgs,
  track: NonNullable<Awaited<ReturnType<typeof findTrackByCode>>>,
  plan: WeighEffects,
): Promise<WeighedRow> {
  const db = getDb();

  await db.transaction(async (tx) => {
    await tx
      .update(tracks)
      .set({
        ...plan.pricing,
        currentStatus: plan.newStatus,
        // §7.13: the box in hand is the latest evidence — overwrite; an empty
        // field (storeMarka null) never clears a stored marka.
        ...(plan.storeMarka != null ? { marka: plan.storeMarka } : {}),
        ...(plan.attachCustomerId != null
          ? { customerId: plan.attachCustomerId }
          : {}),
      })
      .where(
        and(
          eq(tracks.tenantId, args.tenantId),
          eq(tracks.id, track.id),
          isNull(tracks.deletedAt),
        ),
      );

    // Ownership change: the same audit shape `setTracksCustomer` writes, so the
    // track timeline labels it as an attach rather than repeating the status.
    if (plan.attachCustomerId != null) {
      await tx.insert(trackEvents).values({
        trackId: track.id,
        status: plan.newStatus,
        meta: {
          source: WEIGH_EVENT_SOURCE,
          action: 'attach',
          fromCustomerId: null,
          toCustomerId: plan.attachCustomerId,
        },
        createdBy: args.createdBy,
      });
    }

    if (plan.willEvent) {
      await tx.insert(trackEvents).values({
        trackId: track.id,
        status: plan.newStatus,
        meta: {
          source: WEIGH_EVENT_SOURCE,
          created: false,
          marka: plan.marka.kind,
          ...(plan.storeMarka != null ? { markaRaw: plan.storeMarka } : {}),
        },
        createdBy: args.createdBy,
      });
    }
  });

  // Enqueued only after the commit: pg-boss writes through its own connection,
  // so a job sent mid-transaction would survive a rollback (see track-mutations).
  await notify(args.tenantId, track.id, plan);

  return {
    trackId: track.id,
    code: track.codeOriginal,
    weightGrams: plan.pricing.weightGrams,
    priceTiyin: plan.pricing.priceTiyin,
    created: false,
    advanced: plan.willEvent,
    notified: plan.willNotify,
    owner: await ownerById(
      args.tenantId,
      plan.attachCustomerId ?? track.customerId,
    ),
    marka: plan.marka.kind,
    hasPhoto: track.hasPhoto,
  };
}

/** Queue the §4.2 arrival message, when the plan calls for one. */
async function notify(
  tenantId: string,
  trackId: string,
  plan: WeighEffects,
): Promise<void> {
  if (!plan.willNotify || plan.notifyCustomerId == null) return;
  await enqueueNotification({
    tenantId,
    trackId,
    customerId: plan.notifyCustomerId,
    status: plan.newStatus,
  });
}

/**
 * Today's weighings by this employee, newest first — so a reload mid-shift (a
 * phone locking, a tab dropped) does not erase the list the console exists to
 * show. "Today" is an Asia/Tashkent calendar day, via the tested `periodRange`.
 *
 * Sourced from the audit log, which means it holds exactly the weighings that
 * moved a parcel into CHINA_WAREHOUSE. Re-weighing a parcel further down the
 * pipeline writes no event and so does not survive a reload; it is still shown
 * live, which is when it matters.
 */
export async function listTodaysWeighings(
  tenantId: string,
  adminUserId: string,
  now: Date = new Date(),
): Promise<WeighedRow[]> {
  const { startUtc, endUtc } = periodRange(now, 'today');

  const rows = await getDb()
    .select({
      trackId: tracks.id,
      code: tracks.codeOriginal,
      weightGrams: tracks.weightGrams,
      priceTiyin: tracks.priceTiyin,
      meta: trackEvents.meta,
      hasPhoto: hasPhotoExpr,
      clientCode: customers.clientCode,
      fullName: customers.fullName,
    })
    .from(trackEvents)
    .innerJoin(tracks, eq(trackEvents.trackId, tracks.id))
    .leftJoin(customers, eq(tracks.customerId, customers.id))
    .where(
      and(
        eq(tracks.tenantId, tenantId),
        isNull(tracks.deletedAt),
        eq(trackEvents.createdBy, adminUserId),
        gte(trackEvents.createdAt, startUtc),
        lt(trackEvents.createdAt, endUtc),
        sql`${trackEvents.meta}->>'source' = ${WEIGH_EVENT_SOURCE}`,
        // Skip the paired ownership rows — one line per parcel, not two.
        sql`${trackEvents.meta}->>'action' is null`,
      ),
    )
    .orderBy(desc(trackEvents.createdAt))
    .limit(TODAY_LIMIT);

  return rows.map((r) => {
    const meta = (r.meta ?? {}) as { created?: unknown; marka?: unknown };
    const owner = r.clientCode
      ? { clientCode: r.clientCode, fullName: r.fullName }
      : null;
    return {
      trackId: r.trackId,
      code: r.code,
      weightGrams: r.weightGrams ?? 0,
      priceTiyin: r.priceTiyin ?? 0,
      created: meta.created === true,
      advanced: true, // an event exists, so the parcel did move
      notified: owner != null,
      owner,
      marka: (typeof meta.marka === 'string'
        ? meta.marka
        : 'none') as MarkaOutcomeKind,
      hasPhoto: r.hasPhoto,
    };
  });
}

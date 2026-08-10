/** Staff weighing at the China warehouse (SPEC §3.8, §5.14; pricing per §7.4). */

import { and, eq } from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import { enqueueNotification } from '@kargotrack/db/queue';
import {
  trackEvents,
  tracks,
  type Tenant,
  type Track,
} from '@kargotrack/db/schema';
import {
  planWeighEntry,
  type MarkaOutcomeKind,
  type WeighEffects,
  type WeighRejection,
} from '@kargotrack/shared';

import { findCustomerByMarka, getClientCode } from './customers';
import { isUniqueViolation } from './internal';
import { getDefaultTariff } from './tenants';
import { findTrackByCode } from './tracks';

/** `track_events.meta.source` for a weighing done over Telegram. */
const EVENT_SOURCE = 'bot-staff';

/**
 * Weighing outcome. A rejection is a tenant misconfiguration — no default
 * tariff, or a USD tenant with no kurs — and the handler answers it with the
 * generic error rather than writing a parcel down as free.
 */
export type StaffWeighingResult =
  | {
      ok: true;
      track: Track;
      created: boolean;
      /** What the typed marka did, so the reply can say so (tasks.md W5). */
      marka: MarkaOutcomeKind;
      /** The parcel's owner after the write, named as staff would name them. */
      ownerClientCode: string | null;
    }
  | { ok: false; reason: WeighRejection };

/**
 * Apply a staff weighing (SPEC §3.8, §5.14). WHAT weighing does — price, the
 * CREATED→CHINA_WAREHOUSE move, the event, the notification, creating an unknown
 * code unattached, and attaching the customer a marka names — is decided by the
 * shared `planWeighEntry`, the same call the panel's /weigh console makes
 * (tasks.md W2/W5), so the fallback channel and the primary one can never drift.
 * This function only executes the plan.
 *
 * Every query is tenant-scoped (CLAUDE.md rule 1).
 */
export async function applyStaffWeighing(args: {
  tenant: Tenant;
  codeNormalized: string;
  codeOriginal: string;
  weightGrams: number;
  /** The marka exactly as typed, or null when the message carried no third token. */
  marka: string | null;
  createdBy: string;
}): Promise<StaffWeighingResult> {
  const { tenant, weightGrams } = args;

  const [tariff, markaCustomer] = await Promise.all([
    getDefaultTariff(tenant.id),
    args.marka ? findCustomerByMarka(tenant.id, args.marka) : null,
  ]);

  const planFor = (track: Track | undefined) =>
    planWeighEntry({
      currency: tenant.currency,
      usdRateTiyin: tenant.usdRateTiyin,
      tariff: tariff
        ? { id: tariff.id, pricePerKgMinor: tariff.pricePerKgMinor }
        : null,
      weightGrams,
      track: track
        ? { currentStatus: track.currentStatus, customerId: track.customerId }
        : null,
      markaTyped: args.marka != null,
      markaCustomerId: markaCustomer?.id ?? null,
    });

  const existing = await findTrackByCode(tenant.id, args.codeNormalized);
  const plan = planFor(existing);
  if (!plan.ok) return { ok: false, reason: plan.reason };

  if (existing) return finish(args, await weighExisting(args, existing, plan), plan);

  const created = await createWeighed(args, plan);
  if (created) return finish(args, created, plan, true);

  // Lost a race: the code now exists — re-resolve and weigh it instead.
  const raced = await findTrackByCode(tenant.id, args.codeNormalized);
  if (!raced) throw new Error('applyStaffWeighing: insert lost but code gone');
  const racedPlan = planFor(raced);
  if (!racedPlan.ok) return { ok: false, reason: racedPlan.reason };
  return finish(args, await weighExisting(args, raced, racedPlan), racedPlan);
}

type WeighArgs = Parameters<typeof applyStaffWeighing>[0];

/** Name the parcel's owner so the reply can report the marka's effect. */
async function finish(
  args: WeighArgs,
  track: Track,
  plan: WeighEffects,
  created = false,
): Promise<StaffWeighingResult> {
  const ownerId = plan.attachCustomerId ?? track.customerId;
  return {
    ok: true,
    track,
    created,
    marka: plan.marka.kind,
    ownerClientCode: ownerId
      ? await getClientCode(args.tenant.id, ownerId)
      : null,
  };
}

/** Insert an unknown code as a parcel already at the China warehouse. */
async function createWeighed(
  args: WeighArgs,
  plan: WeighEffects,
): Promise<Track | null> {
  const db = getDb();

  let track: Track | undefined;
  try {
    [track] = await db
      .insert(tracks)
      .values({
        tenantId: args.tenant.id,
        codeNormalized: args.codeNormalized,
        codeOriginal: args.codeOriginal,
        customerId: plan.attachCustomerId,
        currentStatus: plan.newStatus,
        ...plan.pricing,
      })
      .returning();
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    return null;
  }
  if (!track) return null;

  // A brand-new parcel needs no separate `attach` event: creation already says
  // whose it is, and `meta.marka` records how that was decided.
  await db.insert(trackEvents).values({
    trackId: track.id,
    status: plan.newStatus,
    meta: { source: EVENT_SOURCE, created: true, marka: plan.marka.kind },
    createdBy: args.createdBy,
  });

  await notify(args.tenant.id, track.id, plan);
  return track;
}

/** Write weight/price (and maybe an owner) onto a parcel we already knew. */
async function weighExisting(
  args: WeighArgs,
  track: Track,
  plan: WeighEffects,
): Promise<Track> {
  const db = getDb();

  const [updated] = await db
    .update(tracks)
    .set({
      ...plan.pricing,
      currentStatus: plan.newStatus,
      ...(plan.attachCustomerId != null
        ? { customerId: plan.attachCustomerId }
        : {}),
    })
    .where(and(eq(tracks.tenantId, args.tenant.id), eq(tracks.id, track.id)))
    .returning();

  // Ownership change: the same audit shape the panel writes, so the track
  // timeline labels it an attach rather than repeating the status.
  if (plan.attachCustomerId != null) {
    await db.insert(trackEvents).values({
      trackId: track.id,
      status: plan.newStatus,
      meta: {
        source: EVENT_SOURCE,
        action: 'attach',
        fromCustomerId: null,
        toCustomerId: plan.attachCustomerId,
      },
      createdBy: args.createdBy,
    });
  }

  if (plan.willEvent) {
    await db.insert(trackEvents).values({
      trackId: track.id,
      status: plan.newStatus,
      meta: { source: EVENT_SOURCE, created: false, marka: plan.marka.kind },
      createdBy: args.createdBy,
    });
  }

  await notify(args.tenant.id, track.id, plan);
  return updated ?? track;
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

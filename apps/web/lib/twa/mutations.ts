/**
 * The Mini App's ONLY writes (tasks.md: add-track in TWA + language switch).
 * Semantics mirror the bot's add-track queries exactly — one behavior, two
 * doors — including the unique-race resolution the handler layer does.
 */

import 'server-only';

import { and, eq, isNull } from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import { customers, trackEvents, tracks } from '@kargotrack/db/schema';
import type { Lang } from '@kargotrack/shared';

export async function findTwaTrackByCode(
  tenantId: string,
  codeNormalized: string,
): Promise<{ id: string; customerId: string | null } | undefined> {
  const db = getDb();
  const [row] = await db
    .select({ id: tracks.id, customerId: tracks.customerId })
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

/** Create a CREATED track attached to the customer, plus its audit event. */
export async function createTwaTrack(args: {
  tenantId: string;
  customerId: string;
  codeNormalized: string;
  codeOriginal: string;
  createdBy: string;
}): Promise<void> {
  const db = getDb();
  const [track] = await db
    .insert(tracks)
    .values({
      tenantId: args.tenantId,
      customerId: args.customerId,
      codeNormalized: args.codeNormalized,
      codeOriginal: args.codeOriginal,
      currentStatus: 'CREATED',
    })
    .returning();
  if (!track) return;
  await db.insert(trackEvents).values({
    trackId: track.id,
    status: 'CREATED',
    meta: { source: 'twa' },
    createdBy: args.createdBy,
  });
}

/** Attach an ownerless track; false = someone else claimed it first. */
export async function claimTwaTrack(
  trackId: string,
  customerId: string,
): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .update(tracks)
    .set({ customerId })
    .where(and(eq(tracks.id, trackId), isNull(tracks.customerId)))
    .returning({ id: tracks.id });
  return rows.length > 0;
}

/** Persist the customer's language choice — the bot reads the same column. */
export async function setTwaCustomerLang(
  tenantId: string,
  customerId: string,
  lang: Lang,
): Promise<void> {
  const db = getDb();
  await db
    .update(customers)
    .set({ lang })
    .where(and(eq(customers.tenantId, tenantId), eq(customers.id, customerId)));
}

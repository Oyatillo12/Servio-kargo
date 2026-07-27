'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';

import { TRACK_STATUSES, type TrackStatus } from '@kargotrack/shared';

import { requireAdmin } from '@/lib/auth';
import {
  assignTracksToBatch,
  setTrackStatuses,
  setTracksCustomer,
  softDeleteTrack,
} from '@/lib/queries';

/**
 * Server actions return already-translated error text rather than message keys:
 * a Server Action runs inside the same request, so `getTranslations()` resolves
 * the very same locale the caller's screen is rendered in, and the client just
 * hands the string to `toast.error`.
 */

const statusSchema = z.enum(
  TRACK_STATUSES as unknown as [TrackStatus, ...TrackStatus[]],
);

const changeSchema = z.object({
  trackIds: z.array(z.string().uuid()).min(1).max(1000),
  status: statusSchema,
});

export interface ChangeStatusResult {
  ok?: boolean;
  error?: string;
  changed?: number;
  queued?: number;
}

/**
 * Bulk / single status change (SPEC §5.2 / §5.3). Validates ids + status,
 * scopes to the session tenant, and lets `setTrackStatuses` apply the §2/§4.2
 * rules. A single-track change just passes one id.
 */
export async function changeTrackStatusesAction(input: {
  trackIds: string[];
  status: TrackStatus;
}): Promise<ChangeStatusResult> {
  const { tenant, admin } = await requireAdmin();
  const t = await getTranslations('tracks');

  const parsed = changeSchema.safeParse(input);
  if (!parsed.success) return { error: t('invalidStatusOrTracks') };

  const res = await setTrackStatuses({
    tenantId: tenant.id,
    trackIds: parsed.data.trackIds,
    status: parsed.data.status,
    createdBy: admin.id,
  });

  revalidatePath('/tracks');
  return { ok: true, ...res };
}

const assignSchema = z.object({
  trackIds: z.array(z.string().uuid()).min(1).max(1000),
  batchId: z.string().uuid().nullable(),
});

export interface AssignBatchResult {
  ok?: boolean;
  error?: string;
  assigned?: number;
}

/**
 * Bulk-attach the selected tracks to a batch (SPEC §5.2 "Reysga biriktirish"),
 * or detach when `batchId` is null. Tenant-scoped.
 */
export async function assignTracksToBatchAction(input: {
  trackIds: string[];
  batchId: string | null;
}): Promise<AssignBatchResult> {
  const { tenant } = await requireAdmin();
  const t = await getTranslations('tracks');

  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) return { error: t('invalidTracksOrBatch') };

  const assigned = await assignTracksToBatch({
    tenantId: tenant.id,
    trackIds: parsed.data.trackIds,
    batchId: parsed.data.batchId,
  });

  revalidatePath('/tracks');
  return { ok: true, assigned };
}

const assignCustomerSchema = z.object({
  trackIds: z.array(z.string().uuid()).min(1).max(1000),
  customerId: z.string().uuid().nullable(),
});

export interface AssignCustomerResult {
  ok?: boolean;
  error?: string;
  /** Tracks whose owner actually changed. */
  changed?: number;
  /** Tracks that already belonged to this customer (§2 no-op). */
  skipped?: number;
}

/**
 * Bulk-attach the selected tracks to one customer (SPEC §5.2 "Mijozga
 * biriktirish"), or detach them when `customerId` is null. This is the day-0
 * path: a channel-history import lands 500 unassigned codes and the admin
 * assigns them per customer. Tenant-scoped; no notifications (see §7.3).
 */
export async function assignTracksCustomerAction(input: {
  trackIds: string[];
  customerId: string | null;
}): Promise<AssignCustomerResult> {
  const { tenant, admin } = await requireAdmin();
  const t = await getTranslations('tracks');

  const parsed = assignCustomerSchema.safeParse(input);
  if (!parsed.success) return { error: t('invalidTracksOrCustomer') };

  const res = await setTracksCustomer({
    tenantId: tenant.id,
    trackIds: parsed.data.trackIds,
    customerId: parsed.data.customerId,
    createdBy: admin.id,
  });
  if (res === 'NO_CUSTOMER') return { error: t('customerNotFound') };

  revalidatePath('/tracks');
  return { ok: true, ...res };
}

export interface DeleteTrackResult {
  ok?: boolean;
  error?: string;
}

/** Soft-delete a track (SPEC §5.3). Tenant-scoped. */
export async function softDeleteTrackAction(
  trackId: string,
): Promise<DeleteTrackResult> {
  const { tenant } = await requireAdmin();

  const parsed = z.string().uuid().safeParse(trackId);
  if (!parsed.success) {
    return { error: (await getTranslations('common'))('errorGeneric') };
  }

  await softDeleteTrack({ tenantId: tenant.id, trackId: parsed.data });

  revalidatePath('/tracks');
  return { ok: true };
}

'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { TRACK_STATUSES, type TrackStatus } from '@kargotrack/shared';

import { requireAdmin } from '@/lib/auth';
import {
  assignTracksToBatch,
  setTrackStatuses,
  softDeleteTrack,
} from '@/lib/queries';

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

  const parsed = changeSchema.safeParse(input);
  if (!parsed.success) return { error: 'Statusni yoki treklarni tekshiring.' };

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

  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) return { error: 'Treklarni yoki reysni tekshiring.' };

  const assigned = await assignTracksToBatch({
    tenantId: tenant.id,
    trackIds: parsed.data.trackIds,
    batchId: parsed.data.batchId,
  });

  revalidatePath('/tracks');
  return { ok: true, assigned };
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
  if (!parsed.success) return { error: 'Xatolik yuz berdi.' };

  await softDeleteTrack({ tenantId: tenant.id, trackId: parsed.data });

  revalidatePath('/tracks');
  return { ok: true };
}

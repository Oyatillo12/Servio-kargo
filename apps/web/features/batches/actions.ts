'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';

import { BATCH_STATUSES, type BatchStatus } from '@kargotrack/shared';

import { authorize, requireAdmin } from '@/lib/auth';
import { changeBatchStatus, createBatch, updateBatchEta } from '@/lib/queries';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();

const createSchema = z.object({
  name: z.string().min(1).max(100),
  transport: z.enum(['avia', 'avto', 'train']),
  etaDate: isoDate,
});

export interface CreateBatchResult {
  ok?: boolean;
  error?: string;
  id?: string;
}

/** Create a batch (SPEC §5.7). */
export async function createBatchAction(input: {
  name: string;
  transport: 'avia' | 'avto' | 'train';
  etaDate: string | null;
}): Promise<CreateBatchResult> {
  const auth = await authorize('batches.manage');
  if (!auth.ok) return { error: auth.error };
  const { tenant } = auth.ctx;
  const t = await getTranslations('batches');

  const parsed = createSchema.safeParse({
    name: input.name.trim(),
    transport: input.transport,
    etaDate: input.etaDate || null,
  });
  if (!parsed.success) return { error: t('invalidFields') };

  const id = await createBatch({
    tenantId: tenant.id,
    name: parsed.data.name,
    transport: parsed.data.transport,
    etaDate: parsed.data.etaDate,
  });

  revalidatePath('/batches');
  return { ok: true, id };
}

export interface UpdateEtaResult {
  ok?: boolean;
  error?: string;
}

/** Update a batch's ETA (SPEC §5.7). */
export async function updateBatchEtaAction(input: {
  batchId: string;
  etaDate: string | null;
}): Promise<UpdateEtaResult> {
  const auth = await authorize('batches.manage');
  if (!auth.ok) return { error: auth.error };
  const { tenant } = auth.ctx;

  const id = z.string().uuid().safeParse(input.batchId);
  const eta = isoDate.safeParse(input.etaDate || null);
  if (!id.success || !eta.success) {
    return { error: (await getTranslations('common'))('errorGeneric') };
  }

  await updateBatchEta(tenant.id, id.data, eta.data);
  revalidatePath(`/batches/${id.data}`);
  return { ok: true };
}

const statusSchema = z.enum(
  BATCH_STATUSES as unknown as [BatchStatus, ...BatchStatus[]],
);

export interface ChangeBatchStatusResult {
  ok?: boolean;
  error?: string;
  changed?: number;
  queued?: number;
}

/**
 * Change a batch status (SPEC §7.10): propagates to non-terminal member tracks
 * with events + queued notifications, and records the batch's own status.
 */
export async function changeBatchStatusAction(input: {
  batchId: string;
  status: BatchStatus;
}): Promise<ChangeBatchStatusResult> {
  const auth = await authorize('batches.manage');
  if (!auth.ok) return { error: auth.error };
  const { tenant, admin } = auth.ctx;
  const t = await getTranslations('batches');

  const id = z.string().uuid().safeParse(input.batchId);
  const status = statusSchema.safeParse(input.status);
  if (!id.success || !status.success) return { error: t('invalidStatus') };

  const res = await changeBatchStatus({
    tenantId: tenant.id,
    batchId: id.data,
    status: status.data,
    createdBy: admin.id,
  });
  if (!res) return { error: t('notFound') };

  revalidatePath(`/batches/${id.data}`);
  revalidatePath('/tracks');
  return { ok: true, ...res };
}

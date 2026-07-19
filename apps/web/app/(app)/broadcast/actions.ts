'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { BROADCAST_MAX_CHARS } from '@kargotrack/shared';

import { requireAdmin } from '@/lib/auth';
import { listCustomerIdsWithTelegram, sendBroadcast } from '@/lib/queries';

export interface BroadcastState {
  ok?: boolean;
  error?: string;
  /** How many recipients the broadcast was queued for. */
  count?: number;
}

const schema = z.object({
  text: z.string().trim().min(1).max(BROADCAST_MAX_CHARS),
});

/** Current reachable-recipient count for the preview (SPEC §5.8). */
export async function getRecipientCountAction(): Promise<number> {
  const { tenant } = await requireAdmin();
  const ids = await listCustomerIdsWithTelegram(tenant.id);
  return ids.length;
}

/**
 * Record a broadcast and fan it out to the throttled queue (SPEC §5.8, §7.11).
 * Tenant-scoped via the session; returns the recipient count.
 */
export async function sendBroadcastAction(
  text: string,
): Promise<BroadcastState> {
  const { tenant } = await requireAdmin();

  const parsed = schema.safeParse({ text });
  if (!parsed.success) {
    return { error: "Xabar matnini kiriting (3500 belgigacha)." };
  }

  const count = await sendBroadcast(tenant.id, parsed.data.text);
  revalidatePath('/broadcast');
  return { ok: true, count };
}

'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';

import { BROADCAST_MAX_CHARS } from '@kargotrack/shared';

import { authorize, requireCapability } from '@/lib/auth';
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

/**
 * Current reachable-recipient count for the preview (SPEC §5.8).
 *
 * Guarded with `requireCapability` rather than `authorize`: it returns a bare
 * number with no room for an error string, and the only caller is the broadcast
 * screen, which the same capability already gates.
 */
export async function getRecipientCountAction(): Promise<number> {
  const { tenant } = await requireCapability('broadcast.send');
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
  const auth = await authorize('broadcast.send');
  if (!auth.ok) return { error: auth.error };
  const { tenant } = auth.ctx;
  const t = await getTranslations('broadcast');

  const parsed = schema.safeParse({ text });
  if (!parsed.success) {
    return { error: t('tooLong', { max: BROADCAST_MAX_CHARS }) };
  }

  const count = await sendBroadcast(tenant.id, parsed.data.text);
  revalidatePath('/broadcast');
  return { ok: true, count };
}

'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';

import { BROADCAST_MAX_CHARS } from '@kargotrack/shared';

import { authorize, requireCapability } from '@/lib/auth';
import {
  cancelBroadcast,
  listCustomerIdsWithTelegram,
  sendBroadcast,
  sendBroadcastTest,
} from '@/lib/queries';

export interface BroadcastState {
  ok?: boolean;
  error?: string;
  /** How many recipients the broadcast was queued for. */
  count?: number;
  /** The row to point the countdown + stop button at (§5.8). */
  broadcastId?: string;
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
 * Nothing leaves for the first 60 seconds — the screen shows a countdown and a
 * cancel that, used inside it, reaches nobody (D-008).
 */
export async function sendBroadcastAction(
  text: string,
): Promise<BroadcastState> {
  const auth = await authorize('broadcast.send');
  if (!auth.ok) return { error: auth.error };
  const { tenant, admin } = auth.ctx;
  const t = await getTranslations('broadcast');

  const parsed = schema.safeParse({ text });
  if (!parsed.success) {
    return { error: t('tooLong', { max: BROADCAST_MAX_CHARS }) };
  }

  const { broadcastId, count } = await sendBroadcast({
    tenantId: tenant.id,
    text: parsed.data.text,
    createdBy: admin.id,
  });
  revalidatePath('/broadcast');
  return { ok: true, count, broadcastId };
}

/**
 * Stop a broadcast (SPEC §5.8, §7.11). Same capability as sending: whoever may
 * fire it may stop it, and stopping is never the more dangerous half.
 *
 * A row that is already cancelled (or finished) reports `ok` rather than an
 * error — the admin's intent is satisfied either way, and a red toast for
 * "already stopped" would only make them wonder what went wrong.
 */
export async function cancelBroadcastAction(
  broadcastId: string,
): Promise<BroadcastState> {
  const auth = await authorize('broadcast.send');
  if (!auth.ok) return { error: auth.error };
  const { tenant, admin } = auth.ctx;

  const id = z.string().uuid().safeParse(broadcastId);
  if (!id.success) {
    return { error: (await getTranslations('common'))('errorGeneric') };
  }

  await cancelBroadcast({
    tenantId: tenant.id,
    broadcastId: id.data,
    cancelledBy: admin.id,
  });
  revalidatePath('/broadcast');
  return { ok: true };
}

/**
 * "Send me a test" (SPEC §5.8, tasks.md K1): the typed text to the signed-in
 * employee's own Telegram chat. Refused with a named reason when they have not
 * linked their account in the bot — the button is disabled there anyway, but a
 * Server Action is a POST endpoint and re-checks what the UI merely hid.
 */
export async function sendBroadcastTestAction(
  text: string,
): Promise<BroadcastState> {
  const auth = await authorize('broadcast.send');
  if (!auth.ok) return { error: auth.error };
  const { tenant, admin } = auth.ctx;
  const t = await getTranslations('broadcast');

  const parsed = schema.safeParse({ text });
  if (!parsed.success) {
    return { error: t('tooLong', { max: BROADCAST_MAX_CHARS }) };
  }
  if (admin.tgUserId == null) return { error: t('testNoTelegram') };

  await sendBroadcastTest({
    tenantId: tenant.id,
    text: parsed.data.text,
    chatId: Number(admin.tgUserId),
  });
  return { ok: true };
}

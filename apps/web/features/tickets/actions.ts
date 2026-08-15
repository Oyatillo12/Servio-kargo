'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';

import { enqueueTicketDelivery } from '@kargotrack/db/queue';
import {
  TICKET_STATUSES,
  clampTicketText,
  type TicketStatus,
} from '@kargotrack/shared';

import { authorize } from '@/lib/auth';
import { addStaffReply, assignTicket, setTicketStatus } from '@/lib/queries';

export interface TicketActionState {
  ok?: boolean;
  error?: string;
}

/**
 * Staff reply (SPEC §5.16 — D-006: the panel is the only staff surface).
 * The message row commits first; only then is the bot delivery queued, so a
 * rollback can never message a customer about a reply that was never saved.
 */
export async function replyTicketAction(input: {
  ticketId: string;
  text: string;
}): Promise<TicketActionState> {
  const auth = await authorize('tickets.handle');
  if (!auth.ok) return { error: auth.error };
  const { tenant, admin } = auth.ctx;
  const t = await getTranslations('tickets');

  const parsed = z.string().uuid().safeParse(input.ticketId);
  if (!parsed.success) {
    return { error: (await getTranslations('common'))('errorGeneric') };
  }
  const text = clampTicketText(input.text);
  if (!text) return { error: t('emptyReply') };

  const messageId = await addStaffReply({
    tenantId: tenant.id,
    ticketId: parsed.data,
    adminId: admin.id,
    text,
  });
  if (!messageId) {
    return { error: (await getTranslations('common'))('errorGeneric') };
  }

  await enqueueTicketDelivery({
    tenantId: tenant.id,
    ticketId: parsed.data,
    kind: 'reply',
    messageId,
  });

  revalidatePath(`/tickets/${parsed.data}`);
  revalidatePath('/tickets');
  return { ok: true };
}

const statusSchema = z.object({
  ticketId: z.string().uuid(),
  status: z.enum(TICKET_STATUSES as unknown as [TicketStatus, ...TicketStatus[]]),
});

/** Status move (§5.16). Closing queues the `ticket_closed_notice` (4.6). */
export async function setTicketStatusAction(input: {
  ticketId: string;
  status: string;
}): Promise<TicketActionState> {
  const auth = await authorize('tickets.handle');
  if (!auth.ok) return { error: auth.error };
  const { tenant } = auth.ctx;

  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) {
    return { error: (await getTranslations('common'))('errorGeneric') };
  }

  const previous = await setTicketStatus({
    tenantId: tenant.id,
    ticketId: parsed.data.ticketId,
    status: parsed.data.status,
  });

  // Only a REAL closure notifies — re-saving 'closed' must not re-message.
  if (previous != null && parsed.data.status === 'closed') {
    await enqueueTicketDelivery({
      tenantId: tenant.id,
      ticketId: parsed.data.ticketId,
      kind: 'closed',
    });
  }

  revalidatePath(`/tickets/${parsed.data.ticketId}`);
  revalidatePath('/tickets');
  revalidatePath('/dashboard');
  return { ok: true };
}

const assignSchema = z.object({
  ticketId: z.string().uuid(),
  adminUserId: z.string().uuid().nullable(),
});

/** Assign / unassign (§5.16) — a workflow aid, not a permission. */
export async function assignTicketAction(input: {
  ticketId: string;
  adminUserId: string | null;
}): Promise<TicketActionState> {
  const auth = await authorize('tickets.handle');
  if (!auth.ok) return { error: auth.error };
  const { tenant } = auth.ctx;

  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) {
    return { error: (await getTranslations('common'))('errorGeneric') };
  }

  const ok = await assignTicket({
    tenantId: tenant.id,
    ticketId: parsed.data.ticketId,
    adminUserId: parsed.data.adminUserId,
  });
  if (!ok) return { error: (await getTranslations('common'))('errorGeneric') };

  revalidatePath(`/tickets/${parsed.data.ticketId}`);
  revalidatePath('/tickets');
  return { ok: true };
}

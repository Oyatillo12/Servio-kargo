'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';

import { can, parseSomToTiyin } from '@kargotrack/shared';

import { authorize } from '@/lib/auth';
import { handoverWithPayment } from '@/lib/queries';

export interface HandoverState {
  ok?: boolean;
  error?: string;
  delivered?: number;
}

const schema = z.object({
  customerId: z.string().uuid(),
  trackIds: z.array(z.string().uuid()).min(1).max(200),
  /** Whole so'm as typed; empty string = no payment. */
  amount: z.string(),
  method: z.enum(['cash', 'click', 'payme', 'other']),
});

/**
 * The counter action (SPEC §5.15): selected parcels → DELIVERED + one payment,
 * atomically. Guarded by `tracks.status`; an amount > 0 additionally requires
 * `payments.record` — a warehouse hand hands parcels over but never takes cash
 * (their screen has no money half, and this re-check is what makes that a rule
 * rather than a hidden input, CLAUDE.md rule 9).
 */
export async function handoverAction(input: {
  customerId: string;
  trackIds: string[];
  amount: string;
  method: 'cash' | 'click' | 'payme' | 'other';
}): Promise<HandoverState> {
  const t = await getTranslations('handover');

  const auth = await authorize('tracks.status');
  if (!auth.ok) return { error: auth.error };
  const { tenant, admin, role } = auth.ctx;

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { error: (await getTranslations('common'))('errorGeneric') };
  }

  // "0" typed on purpose and an empty field both mean "no payment today".
  const raw = parsed.data.amount.trim();
  let amountTiyin = 0;
  if (raw !== '' && raw !== '0') {
    const parsedAmount = parseSomToTiyin(raw);
    if (parsedAmount == null) return { error: t('invalidAmount') };
    amountTiyin = parsedAmount;
  }
  if (amountTiyin > 0 && !can(role, 'payments.record')) {
    return { error: t('paymentNotAllowed') };
  }

  const res = await handoverWithPayment({
    tenantId: tenant.id,
    customerId: parsed.data.customerId,
    trackIds: parsed.data.trackIds,
    amountTiyin,
    method: parsed.data.method,
    createdBy: admin.id,
  });
  if (res === 'STALE_SELECTION') return { error: t('staleSelection') };

  revalidatePath('/handover');
  revalidatePath('/tracks');
  revalidatePath(`/customers/${parsed.data.customerId}`);
  revalidatePath('/customers');
  revalidatePath('/debtors');
  revalidatePath('/dashboard');
  return { ok: true, delivered: res.delivered };
}

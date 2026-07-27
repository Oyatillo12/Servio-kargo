'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';

import { parseSomToTiyin } from '@kargotrack/shared';

import { authorize, requireAdmin } from '@/lib/auth';
import { createPayment, getCustomerDetail } from '@/lib/queries';

export interface PaymentState {
  error?: string;
  ok?: boolean;
}

const schema = z.object({
  customerId: z.string().uuid(),
  amount: z.string(),
  method: z.enum(['cash', 'click', 'payme', 'other']),
  note: z.string().max(255).optional(),
});

/**
 * Record a payment for a customer (SPEC §5.5). Amount is entered in so'm and
 * stored as integer tiyin via the shared, tested `parseSomToTiyin` (rule 6).
 */
export async function recordPaymentAction(
  _prev: PaymentState,
  formData: FormData,
): Promise<PaymentState> {
  const t = await getTranslations('customerDetail');

  const parsed = schema.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    method: formData.get('method'),
    note: formData.get('note') ?? undefined,
  });
  if (!parsed.success) {
    return { error: (await getTranslations('common'))('errorGeneric') };
  }

  const amountTiyin = parseSomToTiyin(parsed.data.amount);
  if (amountTiyin == null) return { error: t('invalidAmount') };

  const auth = await authorize('payments.record');
  if (!auth.ok) return { error: auth.error };
  const { tenant, admin } = auth.ctx;

  // Scope check: the customer must belong to the session tenant (rule 1).
  const detail = await getCustomerDetail(tenant.id, parsed.data.customerId);
  if (!detail) {
    return { error: (await getTranslations('tracks'))('customerNotFound') };
  }

  const note = parsed.data.note?.trim();
  await createPayment({
    tenantId: tenant.id,
    customerId: parsed.data.customerId,
    amountTiyin,
    method: parsed.data.method,
    note: note ? note : null,
    createdBy: admin.id,
  });

  revalidatePath(`/customers/${parsed.data.customerId}`);
  revalidatePath('/customers');
  revalidatePath('/debtors');
  // Payments can now be recorded straight from the dashboard, whose revenue
  // and debt figures are exactly what this changes.
  revalidatePath('/dashboard');
  return { ok: true };
}

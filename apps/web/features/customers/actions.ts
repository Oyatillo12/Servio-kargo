'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';

import { parseSomToTiyin } from '@kargotrack/shared';

import { authorize, requireAdmin } from '@/lib/auth';
import {
  createPayment,
  getCustomerDetail,
  reversePayment,
  updateCustomer,
} from '@/lib/queries';

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

// --- Storno (tasks.md A7) ---------------------------------------------------

export interface ReversePaymentState {
  ok?: boolean;
  error?: string;
}

// The reason is what turns "money disappeared from the ledger" into an audit
// entry — required, not decorative.
const reverseSchema = z.object({
  paymentId: z.string().uuid(),
  reason: z.string().trim().min(3).max(255),
});

/**
 * Cancel a payment with an append-only storno row (tasks.md A7). Never deletes:
 * a NEW negative payment references the original, the reason lands in `note`,
 * the canceler in `created_by` — visible in the ledger and in cash-by-staff.
 */
export async function reversePaymentAction(input: {
  paymentId: string;
  reason: string;
}): Promise<ReversePaymentState> {
  const t = await getTranslations('customerDetail');

  const auth = await authorize('payments.cancel');
  if (!auth.ok) return { error: auth.error };
  const { tenant, admin } = auth.ctx;

  const parsed = reverseSchema.safeParse(input);
  if (!parsed.success) return { error: t('stornoReasonRequired') };

  const res = await reversePayment({
    tenantId: tenant.id,
    paymentId: parsed.data.paymentId,
    reason: parsed.data.reason,
    createdBy: admin.id,
  });
  if (!res.ok) {
    if (res.error === 'ALREADY_REVERSED' || res.error === 'IS_REVERSAL') {
      return { error: t('stornoAlreadyReversed') };
    }
    return { error: (await getTranslations('common'))('errorGeneric') };
  }

  revalidatePath(`/customers/${res.customerId}`);
  revalidatePath('/customers');
  revalidatePath('/debtors');
  // Same money the dashboard's tushum/debt/cash-by-staff figures sum over.
  revalidatePath('/dashboard');
  return { ok: true };
}

// --- Edit name/phone (tasks.md A6) ------------------------------------------

export interface UpdateCustomerState {
  ok?: boolean;
  error?: string;
}

// Same phone rule as creation (§7.12): the bot links on this number, so it is
// required even though the column is nullable. Name stays optional.
const updateSchema = z.object({
  customerId: z.string().uuid(),
  phone: z.string().trim().min(4).max(32),
  fullName: z.string().trim().max(120),
});

/**
 * Edit a customer's name/phone (tasks.md A6). `phone_normalized` is recomputed
 * by `updateCustomer`; a phone already held by another customer is refused with
 * their client code, exactly like creation.
 */
export async function updateCustomerAction(input: {
  customerId: string;
  phone: string;
  fullName: string;
}): Promise<UpdateCustomerState> {
  const auth = await authorize('customers.manage');
  if (!auth.ok) return { error: auth.error };
  const { tenant } = auth.ctx;
  const t = await getTranslations('customers');

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { error: t('invalidPhone') };
  if (!/\d/.test(parsed.data.phone)) return { error: t('malformedPhone') };

  const res = await updateCustomer({
    tenantId: tenant.id,
    customerId: parsed.data.customerId,
    phone: parsed.data.phone,
    fullName: parsed.data.fullName || null,
  });
  if (!res.ok) {
    if (res.error === 'DUPLICATE_PHONE') {
      return { error: t('phoneTaken', { clientCode: res.existing.clientCode }) };
    }
    return { error: (await getTranslations('tracks'))('customerNotFound') };
  }

  revalidatePath(`/customers/${parsed.data.customerId}`);
  revalidatePath('/customers');
  return { ok: true };
}

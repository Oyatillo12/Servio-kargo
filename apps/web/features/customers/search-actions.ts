'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';

import { authorize, requireCapability } from '@/lib/auth';
import type { CustomerOption } from '@/lib/customer-types';
import { createCustomer, searchCustomers } from '@/lib/queries';

/**
 * Customer search + creation used by the assignment picker (SPEC §5.3) and the
 * "new customer" form (§5.5). Both live here rather than next to a route so the
 * picker can be dropped into any screen — track detail, the tracks bulk bar,
 * and later the unassigned view (AUDIT.md T11).
 */

/** Typeahead for the assignment picker. Tenant-scoped, capped server-side. */
export async function searchCustomersAction(
  q: string,
): Promise<CustomerOption[]> {
  // Returns a bare array, so a refusal has nowhere to render — the capability
  // is the one every role that reaches a picker already holds.
  const { tenant } = await requireCapability('customers.view');
  const term = z.string().max(100).safeParse(q);
  return searchCustomers(tenant.id, term.success ? term.data : '');
}

export interface CreateCustomerState {
  ok?: boolean;
  error?: string;
  customer?: CustomerOption;
  /** Set when the phone already belongs to someone — the admin can open them. */
  duplicate?: CustomerOption;
}

// Phone is what the bot links on later (§7.12), so it is required here even
// though the column is nullable — a hand-entered customer with no phone can
// never be matched to their Telegram account.
const createSchema = z.object({
  phone: z.string().trim().min(4).max(32),
  fullName: z.string().trim().max(120),
});

/**
 * Create a customer from the panel (SPEC §5.5). `client_code` is assigned
 * automatically and `tg_user_id` stays NULL until the person opens the bot.
 */
export async function createCustomerAction(input: {
  phone: string;
  fullName: string;
}): Promise<CreateCustomerState> {
  const auth = await authorize('customers.manage');
  if (!auth.ok) return { error: auth.error };
  const { tenant } = auth.ctx;
  const t = await getTranslations('customers');

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { error: t('invalidPhone') };
  if (!/\d/.test(parsed.data.phone)) return { error: t('malformedPhone') };

  const res = await createCustomer({
    tenantId: tenant.id,
    codePrefix: tenant.codePrefix,
    phone: parsed.data.phone,
    fullName: parsed.data.fullName || null,
  });

  if (!res.ok) {
    return {
      error: t('phoneTaken', { clientCode: res.existing.clientCode }),
      duplicate: res.existing,
    };
  }

  revalidatePath('/customers');
  return {
    ok: true,
    customer: {
      id: res.customer.id,
      clientCode: res.customer.clientCode,
      fullName: res.customer.fullName,
      phone: res.customer.phone,
      hasTelegram: false,
    },
  };
}

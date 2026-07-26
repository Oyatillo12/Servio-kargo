'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireAdmin } from '@/lib/auth';
import type { CustomerOption } from '@/lib/customer-types';
import { createCustomer, searchCustomers } from '@/lib/queries';

/**
 * Customer search + creation used by the assignment picker (SPEC §5.3) and the
 * "Yangi mijoz" form (§5.5). Both live here rather than next to a route so the
 * picker can be dropped into any screen — track detail, the tracks bulk bar,
 * and later the unassigned view (T11).
 */

/** Typeahead for the assignment picker. Tenant-scoped, capped server-side. */
export async function searchCustomersAction(
  q: string,
): Promise<CustomerOption[]> {
  const { tenant } = await requireAdmin();
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
  const { tenant } = await requireAdmin();

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Telefon raqamini kiriting (kamida 4 ta belgi).' };
  }
  if (!/\d/.test(parsed.data.phone)) {
    return { error: "Telefon raqami noto'g'ri." };
  }

  const res = await createCustomer({
    tenantId: tenant.id,
    codePrefix: tenant.codePrefix,
    phone: parsed.data.phone,
    fullName: parsed.data.fullName || null,
  });

  if (!res.ok) {
    return {
      error: `Bu telefon allaqachon ${res.existing.clientCode} mijozida.`,
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

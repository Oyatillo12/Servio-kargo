'use server';

import { requireAdmin } from '@/lib/auth';
import { getCustomerDetail, listDebtors, queueReminder } from '@/lib/queries';

export interface ReminderState {
  ok?: boolean;
  error?: string;
  /** How many reminders were queued (1 for a single customer). */
  count?: number;
}

/**
 * Queue a debt reminder for one customer (SPEC §5.5/§5.6 "Eslatma yuborish").
 * Tenant-scoped: the customer is re-resolved under the session tenant before
 * enqueueing, so a tampered id can't target another tenant's customer.
 */
export async function sendReminderAction(
  customerId: string,
): Promise<ReminderState> {
  const { tenant } = await requireAdmin();
  const detail = await getCustomerDetail(tenant.id, customerId);
  if (!detail) return { error: 'Mijoz topilmadi.' };
  await queueReminder(tenant.id, customerId);
  return { ok: true, count: 1 };
}

/** Queue a reminder for every current debtor (SPEC §5.6 "Barchasiga…"). */
export async function sendAllRemindersAction(): Promise<ReminderState> {
  const { tenant } = await requireAdmin();
  const debtors = await listDebtors(tenant.id);
  for (const d of debtors) {
    await queueReminder(tenant.id, d.id);
  }
  return { ok: true, count: debtors.length };
}

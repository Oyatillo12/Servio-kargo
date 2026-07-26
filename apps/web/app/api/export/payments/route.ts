import { z } from 'zod';

import {
  EXPORT_MAX_ROWS,
  buildPaymentsSheet,
  truncationNotice,
} from '@kargotrack/shared';

import { requireAdmin } from '@/lib/auth';
import { xlsxResponse } from '@/lib/export-http';
import { listPaymentsForExport } from '@/lib/queries';

/**
 * Excel export of the payment ledger (AUDIT.md T2). `customer=<uuid>` narrows
 * it to one customer's statement; the query stays tenant-scoped either way, so
 * another tenant's customer id simply matches nothing.
 */

const Query = z.object({
  customer: z.string().uuid().optional().catch(undefined),
});

export async function GET(req: Request) {
  const { tenant } = await requireAdmin();

  const params = new URL(req.url).searchParams;
  const { customer } = Query.parse({
    customer: params.get('customer') ?? undefined,
  });

  const { rows, total } = await listPaymentsForExport(tenant.id, {
    customerId: customer,
  });

  const sheet = buildPaymentsSheet(rows, {
    notice: truncationNotice(total, EXPORT_MAX_ROWS),
  });
  return xlsxResponse(sheet, 'tolovlar');
}
